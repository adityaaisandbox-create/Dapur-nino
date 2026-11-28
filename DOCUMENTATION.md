# Dokumentasi Database & API Gerai Nino

---

## 1. Skema Database (SQLite)

**File:** `/root/data/gerai-nino.db`

### Tabel: `stock` (Master Stok & Produk)

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unik |
| name | TEXT | NOT NULL, UNIQUE | Nama item/stok |
| category | TEXT | NOT NULL, CHECK('produk','consumable') | `produk` = makanan/minuman, `consumable` = bahan/kemasan |
| type | TEXT | NOT NULL, CHECK('stock','non-stock') | `stock` = dihitung stoknya, `non-stock` = tidak dihitung (mis. tusuk sate) |
| unit | TEXT | DEFAULT 'pcs' | Satuan (pcs, botol, liter, pack, dll) |
| current_qty | INTEGER | DEFAULT 0 | Stok real-time (diupdate otomatis via trigger) |
| min_qty | INTEGER | DEFAULT 0 | Batas minimum untuk alert |
| harga_beli | INTEGER | DEFAULT 0 | Harga beli per unit |
| harga_jual | INTEGER | DEFAULT 0 | Harga jual per unit (0 untuk consumable non-jual) |
| is_active | INTEGER | DEFAULT 1 | 1=aktif, 0=nonaktif |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | Waktu dibuat |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | Waktu diupdate |

### Tabel: `stock_movement` (Pergerakan Stok)

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unik |
| stock_id | INTEGER | NOT NULL, FK→stock.id | Referensi ke master stok |
| movement_type | TEXT | NOT NULL, CHECK('in','out') | `in` = masuk, `out` = keluar |
| quantity | INTEGER | NOT NULL | Jumlah unit |
| reference_type | TEXT | NOT NULL | Sumber: `pembelian`, `transaksi`, `adjustment`, `opname`, `return` |
| reference_id | INTEGER | | ID referensi (pembelian_id, transaksi_id, dll) |
| reference_note | TEXT | | Catatan tambahan |
| unit_cost | INTEGER | DEFAULT 0 | Harga per unit saat movement |
| total_cost | INTEGER | DEFAULT 0 | quantity × unit_cost |
| waktu | TEXT | DEFAULT CURRENT_TIMESTAMP | Waktu pergerakan |

### Tabel: `pembelian` (Pembelian dari Supplier)

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unik |
| invoice_id | TEXT | NOT NULL, UNIQUE | Nomor invoice pembelian |
| supplier | TEXT | NOT NULL | Nama supplier |
| waktu | TEXT | NOT NULL | Waktu pembelian |
| total | INTEGER | NOT NULL | Total nilai pembelian |
| status | TEXT | DEFAULT 'received' | `ordered`, `received`, `cancelled` |
| note | TEXT | | Catatan |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | Waktu dibuat |

### Tabel: `harga` (Daftar Harga Jual)

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unik |
| nama | TEXT | NOT NULL, UNIQUE | Nama produk (mis. "Donat polos/gula") |
| harga | INTEGER | NOT NULL | Harga jual |
| satuan | TEXT | DEFAULT 'pcs' | Satuan: pcs, paket, cup, dll |
| isi | INTEGER | DEFAULT 1 | Jumlah unit per paket (untuk harga paket) |
| tipe | TEXT | DEFAULT 'stock', CHECK('stock','non-stock') | `stock` = divalidasi stok, `non-stock` = tidak divalidasi stok |
| is_active | INTEGER | DEFAULT 1 | 1=aktif, 0=nonaktif |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | Waktu dibuat |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | Waktu diupdate |

### Tabel: `pembelian_items` (Detail Item Pembelian)

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unik |
| pembelian_id | INTEGER | NOT NULL, FK→pembelian.id | Referensi pembelian |
| stock_id | INTEGER | NOT NULL, FK→stock.id | Referensi master stok |
| item_name | TEXT | NOT NULL | Nama item (snapshot) |
| qty | INTEGER | NOT NULL | Jumlah beli |
| unit_cost | INTEGER | NOT NULL | Harga beli per unit |
| subtotal | INTEGER | NOT NULL | qty × unit_cost |

### Tabel: `transaksi` (Transaksi Penjualan)

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unik |
| invoice_id | TEXT | NOT NULL, UNIQUE | Nomor invoice (TX-YYYYMMDD-XXX) |
| customer | TEXT | NOT NULL | Nama pelanggan |
| waktu | TEXT | NOT NULL | Waktu transaksi |
| phone | TEXT | NOT NULL | No. telepon pelanggan |
| address | TEXT | NOT NULL | Alamat/gerai |
| total | INTEGER | NOT NULL | Total penjualan |
| photo | TEXT | | Foto bukti (opsional) |
| status | TEXT | DEFAULT 'completed' | `completed`, `cancelled`, `pending` |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | Waktu dibuat |

### Tabel: `transaksi_items` (Detail Item Transaksi)

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unik |
| transaksi_id | INTEGER | NOT NULL, FK→transaksi.id | Referensi transaksi |
| stock_id | INTEGER | FK→stock.id | Referensi master stok (nullable untuk non-stock) |
| item_name | TEXT | NOT NULL | Nama item (snapshot) |
| category | TEXT | NOT NULL, CHECK('produk','consumable') | Kategori item |
| type | TEXT | NOT NULL, CHECK('stock','non-stock') | Tipe stok |
| qty | INTEGER | NOT NULL | Jumlah terjual |
| unit_price | INTEGER | NOT NULL | Harga jual per unit |
| subtotal | INTEGER | NOT NULL | qty × unit_price |

---

## 2. Trigger Otomatis (Business Logic)

### Trigger: `trg_pembelian_items_after_insert`
- **Event:** AFTER INSERT ON `pembelian_items`
- **Aksi:**
  1. Insert ke `stock_movement` dengan `movement_type='in'`, `reference_type='pembelian'`
  2. Update `stock.current_qty += qty` WHERE id = NEW.stock_id

### Trigger: `trg_transaksi_items_after_insert`
- **Event:** AFTER INSERT ON `transaksi_items`
- **Aksi:**
  1. Insert ke `stock_movement` dengan `movement_type='out'`, `reference_type='transaksi'` (hanya jika `type='stock'`)
  2. Update `stock.current_qty -= qty` WHERE id = NEW.stock_id AND type='stock'

---

## 3. API Endpoints

**Base URL:** `http://localhost:3001/api`

### 3.1 Master Stok - `/api/stock`

#### GET `/api/stock`
Ambil semua item stok aktif.
```bash
curl http://localhost:3001/api/stock
```
**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Nasi Goreng",
      "category": "produk",
      "type": "stock",
      "unit": "pcs",
      "current_qty": 48,
      "min_qty": 10,
      "harga_beli": 12000,
      "harga_jual": 20000,
      "is_active": 1,
      "created_at": "2026-11-28 01:27:16",
      "updated_at": "2026-11-28 01:27:31"
    }
  ]
}
```

#### POST `/api/stock`
Tambah item stok baru.
```bash
curl -X POST http://localhost:3001/api/stock \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ayam Goreng",
    "category": "produk",
    "type": "stock",
    "unit": "pcs",
    "current_qty": 0,
    "min_qty": 10,
    "harga_beli": 15000,
    "harga_jual": 25000
  }'
```
**Response:** `{ "id": 11 }`

---

### 3.2 Pergerakan Stok - `/api/stock/movement`

#### GET `/api/stock/movement`
Ambil riwayat pergerakan stok dengan filter.

**Query Parameters:**
| Param | Tipe | Deskripsi |
|-------|------|-----------|
| stock_id | integer | Filter by stock ID |
| start_date | string (YYYY-MM-DD) | Filter tanggal mulai |
| end_date | string (YYYY-MM-DD) | Filter tanggal akhir |
| movement_type | string | `in` atau `out` |
| limit | integer | Default 100 |

```bash
# Semua movement
curl http://localhost:3001/api/stock/movement

# Filter stock_id=1, tanggal 2026-11-28
curl "http://localhost:3001/api/stock/movement?stock_id=1&start_date=2026-11-28&end_date=2026-11-28"

# Hanya movement IN
curl "http://localhost:3001/api/stock/movement?movement_type=in"
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "stock_id": 1,
      "movement_type": "in",
      "quantity": 50,
      "reference_type": "pembelian",
      "reference_id": 1,
      "reference_note": null,
      "unit_cost": 12000,
      "total_cost": 600000,
      "waktu": "2026-11-28 01:27:21",
      "stock_name": "Nasi Goreng",
      "category": "produk",
      "type": "stock",
      "unit": "pcs"
    }
  ]
}
```

#### POST `/api/stock/movement`
Catat pergerakan stok manual (adjustment, opname, return).
```bash
curl -X POST http://localhost:3001/api/stock/movement \
  -H "Content-Type: application/json" \
  -d '{
    "stock_id": 1,
    "movement_type": "in",
    "quantity": 10,
    "reference_type": "adjustment",
    "reference_note": "Koreksi stok fisik",
    "unit_cost": 12000
  }'
```

---

### 3.3 Pembelian - `/api/pembelian`

#### GET `/api/pembelian`
Ambil semua pembelian dengan detail item.
```bash
curl http://localhost:3001/api/pembelian
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "invoice_id": "PB-20261128-001",
      "supplier": "Supplier Berkah",
      "waktu": "2026-11-28 08:00:00",
      "total": 1500000,
      "status": "received",
      "note": null,
      "items": [
        { "name": "Nasi Goreng", "qty": 50, "unit_cost": 12000, "subtotal": 600000 }
      ]
    }
  ]
}
```

#### POST `/api/pembelian`
Catat pembelian baru (otomatis update stok & movement IN).
```bash
curl -X POST http://localhost:3001/api/pembelian \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": "PB-20261128-002",
    "supplier": "CV Makmur",
    "waktu": "2026-11-28 09:00:00",
    "total": 500000,
    "status": "received",
    "note": "Pembelian rutin",
    "items": [
      { "stock_id": 1, "name": "Nasi Goreng", "qty": 20, "unit_cost": 12000, "subtotal": 240000 },
      { "stock_id": 5, "name": "Rice Cup", "qty": 100, "unit_cost": 800, "subtotal": 80000 }
    ]
  }'
```

---

### 3.4 Penjualan - `/api/penjualan`

#### GET `/api/penjualan`
Ambil semua transaksi penjualan dengan detail item.
```bash
curl http://localhost:3001/api/penjualan
```

---

### 3.5 Daftar Harga - `/api/harga`

#### GET `/api/harga`
Ambil daftar harga jual produk.
```bash
curl http://localhost:3001/api/harga
```
**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "nama": "Donat polos/gula",
      "harga": 3000,
      "satuan": "pcs",
      "isi": 1,
      "tipe": "stock",
      "is_active": 1,
      "created_at": "2026-11-28 08:00:00",
      "updated_at": "2026-11-28 08:00:00"
    }
  ]
}
```

#### POST `/api/harga`
Tambah harga produk baru.
```bash
curl -X POST http://localhost:3001/api/harga \
  -H "Content-Type: application/json" \
  -d '{
    "nama": "Donat toping /6",
    "harga": 23000,
    "satuan": "paket",
    "isi": 6,
    "tipe": "stock"
  }'
```

#### PATCH `/api/harga`
Update harga produk berdasarkan ID.
```bash
curl -X PATCH http://localhost:3001/api/harga \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "harga": 3500,
    "is_active": 1
  }'
```

**Field Wajib:** `id` (ID harga yang akan diupdate)
**Field Opsional:** `nama`, `harga`, `satuan`, `isi`, `tipe`, `is_active`
**Validasi:** `id` ditemukan → update berhasil (status **200**)
**Sukses:** `{ "success": true }`

**Keterangan `isi`:** Dipakai untuk harga paket (mis. `Donat toping /6` berisi 6 pcs, `Dimsum /3` berisi 3 pcs). `tipe: non-stock` tidak masuk validasi stok saat transaksi.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "invoiceId": "TX-20261128-001",
      "customer": "Budi Santoso",
      "waktu": "2026-11-28 12:00:00",
      "phone": "08123456789",
      "address": "Gerai Utama",
      "total": 47000,
      "photo": null,
      "status": "completed",
      "items": [
        { "name": "Nasi Goreng", "qty": 2, "unit_price": 20000, "category": "produk", "type": "stock" },
        { "name": "Es Teh Manis", "qty": 1, "unit_price": 7000, "category": "produk", "type": "stock" },
        { "name": "Rice Cup", "qty": 2, "unit_price": 0, "category": "consumable", "type": "stock" }
      ]
    }
  ]
}
```

#### POST `/api/penjualan`
Catat transaksi penjualan (otomatis validasi stok & update movement OUT).
```bash
curl -X POST http://localhost:3001/api/penjualan \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "TX-20261128-002",
    "customer": "Siti Rahma",
    "waktu": "2026-11-28 13:30:00",
    "phone": "08129876543",
    "address": "Gerai Cabang",
    "total": 38000,
    "items": [
      { "stock_id": 1, "name": "Nasi Goreng", "category": "produk", "type": "stock", "qty": 1, "unit_price": 20000 },
      { "stock_id": 2, "name": "Mie Goreng", "category": "produk", "type": "stock", "qty": 1, "unit_price": 18000 },
      { "stock_id": 8, "name": "Tusuk Sate", "category": "consumable", "type": "non-stock", "qty": 1, "unit_price": 0 }
    ]
  }'
```

**Validasi Otomatis:**
- Item dengan `type: "stock"` → dicek `stock.current_qty >= qty`, gagal kalau tidak cukup
- Item dengan `type: "non-stock"` → lewati validasi stok

---

## 4. Contoh Alur Kerja Lengkap

### Scenario: Hari Operasional Gerai

```bash
# 1. Pagi: Cek stok awal
curl http://localhost:3001/api/stock

# 2. Pembelian bahan baku dari supplier
curl -X POST http://localhost:3001/api/pembelian \
  -H "Content-Type: application/json" \
  -d '{"invoice_id":"PB-20261128-003","supplier":"PT Sejahtera","waktu":"2026-11-28 07:00:00","total":2000000,"status":"received","items":[{"stock_id":1,"name":"Nasi Goreng","qty":30,"unit_cost":12000},{"stock_id":5,"name":"Rice Cup","qty":200,"unit_cost":800}]}'

# 3. Cek stok sudah bertambah
curl http://localhost:3001/api/stock

# 4. Siang: Transaksi penjualan pelanggan
curl -X POST http://localhost:3001/api/penjualan \
  -H "Content-Type: application/json" \
  -d '{"invoiceId":"TX-20261128-003","customer":"Walk-in","waktu":"2026-11-28 12:30:00","phone":"0811111111","address":"Gerai Utama","total":56000,"items":[{"stock_id":1,"name":"Nasi Goreng","category":"produk","type":"stock","qty":2,"unit_price":20000},{"stock_id":3,"name":"Es Teh Manis","category":"produk","type":"stock","qty":2,"unit_price":7000},{"stock_id":5,"name":"Rice Cup","category":"consumable","type":"stock","qty":2,"unit_price":0}]}'

# 5. Cek pergerakan stok hari ini
curl "http://localhost:3001/api/stock/movement?start_date=2026-11-28&end_date=2026-11-28"

# 6. Sore: Laporan stok akhir hari
curl http://localhost:3001/api/stock
```

---

## 5. Error Handling

| HTTP Status | Kondisi |
|-------------|---------|
| 200 | Sukses GET |
| 201 | Sukses POST (created) |
| 400 | Field wajib hilang / validasi gagal |
| 404 | Resource tidak ditemukan |
| 409 | Duplicate unique constraint (invoice_id, stock name) |
| 500 | Server error |

**Format Error Response:**
```json
{ "error": "Deskripsi kesalahan" }
```

---

## 6. Deployment & Service

- **Dashboard:** `http://localhost:3001` (Next.js)
- **Service systemd:** `next-dashboard`
- **Database:** `/root/data/gerai-nino.db`
- **Restart service:** `systemctl restart next-dashboard`
- **Logs:** `journalctl -u next-dashboard -f`

---

## 7. Integrasi dengan Asisten Gerai Nino

Asisten Nino bisa memanggil API ini via function calling:
- `create_purchase` → POST `/api/pembelian`
- `create_sale` → POST `/api/penjualan`
- `check_stock` → GET `/api/stock`
- `get_stock_movement` → GET `/api/stock/movement`
- `add_stock_item` → POST `/api/stock`
- `get_price_list` → GET `/api/harga`
- `create_price` → POST `/api/harga`

Semua field sudah sesuai dengan kebutuhan: **kapan stock masuk (pembelian), pergerakan stok (movement), transaksi penjualan (transaksi), daftar harga jual (harga)**.