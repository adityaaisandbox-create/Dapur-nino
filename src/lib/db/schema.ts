import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

const DB_PATH = process.env.DB_PATH || '/root/data/gerai-nino.db';

export async function getDb() {
  return open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
}

export async function initDb() {
  const db = await getDb();

  await db.exec(`
    -- ============================================
    -- MASTER STOCK TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,              -- Nama item: "Rice Cup", "Nasi Goreng"
      category TEXT NOT NULL CHECK (category IN ('produk', 'consumable')),  -- Kategori
      type TEXT NOT NULL CHECK (type IN ('stock', 'non-stock')),            -- Tipe stok
      unit TEXT NOT NULL DEFAULT 'pcs',       -- Satuan: pcs, box, pack, kg, liter
      current_qty INTEGER NOT NULL DEFAULT 0, -- Quantity terkini (real-time)
      min_qty INTEGER NOT NULL DEFAULT 0,     -- Minimum stok untuk alert
      harga_beli INTEGER DEFAULT 0,           -- Harga beli per unit (opsional)
      harga_jual INTEGER DEFAULT 0,           -- Harga jual per unit (opsional)
      is_active INTEGER NOT NULL DEFAULT 1,   -- 1=aktif, 0=nonaktif
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================
    -- STOCK MOVEMENT TABLE (Semua pergerakan masuk/keluar)
    -- ============================================
    CREATE TABLE IF NOT EXISTS stock_movement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id INTEGER NOT NULL,              -- FK ke stock.id
      movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out')),  -- in=masuk, out=keluar
      quantity INTEGER NOT NULL,              -- Jumlah yang bergerak
      reference_type TEXT NOT NULL CHECK (reference_type IN ('pembelian', 'transaksi', 'adjustment', 'retur', 'rusak', 'lainnya')), -- Sumber pergerakan
      reference_id INTEGER,                   -- ID referensi (transaksi.id, pembelian.id, dll)
      reference_note TEXT,                    -- Catatan tambahan
      unit_cost INTEGER DEFAULT 0,            -- Harga per unit saat movement (untuk COGS)
      total_cost INTEGER DEFAULT 0,           -- quantity * unit_cost
      waktu DATETIME DEFAULT CURRENT_TIMESTAMP, -- Waktu pergerakan
      created_by TEXT DEFAULT 'system',       -- Siapa yang buat (user/system)
      FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE RESTRICT
    );

    -- ============================================
    -- TRANSAKSI PENJUALAN (Header)
    -- ============================================
    CREATE TABLE IF NOT EXISTS transaksi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT UNIQUE NOT NULL,        -- ID unik: TX-20261128-001
      customer TEXT NOT NULL,                 -- Nama pelanggan
      waktu TEXT NOT NULL,                    -- Waktu transaksi (YYYY-MM-DD HH:MM:SS)
      phone TEXT NOT NULL,                    -- Metode bayar: Cash, QRIS, Transfer
      address TEXT NOT NULL,                  -- Lokasi: "Gerai Nino (WIB)"
      total INTEGER NOT NULL,                 -- Total nominal
      photo TEXT,                             -- URL foto struk
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================
    -- TRANSAKSI ITEMS (Detail item dalam transaksi)
    -- Menggantikan transaksi_produk + transaksi_stock
    -- ============================================
    CREATE TABLE IF NOT EXISTS transaksi_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaksi_id INTEGER NOT NULL,
      stock_id INTEGER NOT NULL,              -- FK ke stock.master (untuk konsistensi nama, harga, dll)
      item_name TEXT NOT NULL,                -- Nama item snapshot (jika stock berubah nama)
      category TEXT NOT NULL CHECK (category IN ('produk', 'consumable')),
      type TEXT NOT NULL CHECK (type IN ('stock', 'non-stock')),
      qty INTEGER NOT NULL,                   -- Quantity terjual
      unit_price INTEGER NOT NULL,            -- Harga jual per unit saat transaksi
      subtotal INTEGER NOT NULL,              -- qty * unit_price
      FOREIGN KEY (transaksi_id) REFERENCES transaksi(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE RESTRICT
    );

    -- ============================================
    -- PEMBELIAN STOCK (Opsional - untuk tracking stock in)
    -- ============================================
    CREATE TABLE IF NOT EXISTS pembelian (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT UNIQUE NOT NULL,        -- No faktur pembelian
      supplier TEXT NOT NULL,                 -- Nama supplier
      waktu TEXT NOT NULL,                    -- Tanggal pembelian
      total INTEGER NOT NULL,                 -- Total pembelian
      status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('ordered', 'received', 'cancelled')),
      note TEXT,                              -- Catatan
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pembelian_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pembelian_id INTEGER NOT NULL,
      stock_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL,
      subtotal INTEGER NOT NULL,
      FOREIGN KEY (pembelian_id) REFERENCES pembelian(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE RESTRICT
    );

    -- ============================================
    -- INDEXES
    -- ============================================
    CREATE INDEX IF NOT EXISTS idx_stock_category_type ON stock(category, type);
    CREATE INDEX IF NOT EXISTS idx_stock_active ON stock(is_active);
    CREATE INDEX IF NOT EXISTS idx_stock_movement_stock_id ON stock_movement(stock_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movement_waktu ON stock_movement(waktu);
    CREATE INDEX IF NOT EXISTS idx_stock_movement_ref ON stock_movement(reference_type, reference_id);
    CREATE INDEX IF NOT EXISTS idx_transaksi_invoice ON transaksi(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_transaksi_waktu ON transaksi(waktu);
    CREATE INDEX IF NOT EXISTS idx_transaksi_status ON transaksi(status);
    CREATE INDEX IF NOT EXISTS idx_transaksi_items_transaksi ON transaksi_items(transaksi_id);
    CREATE INDEX IF NOT EXISTS idx_transaksi_items_stock ON transaksi_items(stock_id);
    CREATE INDEX IF NOT EXISTS idx_pembelian_invoice ON pembelian(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_pembelian_waktu ON pembelian(waktu);

    -- ============================================
    -- TRIGGERS: Auto-update stock.current_qty on movement
    -- ============================================
    CREATE TRIGGER IF NOT EXISTS trg_stock_movement_after_insert
    AFTER INSERT ON stock_movement
    BEGIN
      UPDATE stock 
      SET current_qty = CASE 
        WHEN NEW.movement_type = 'in' THEN current_qty + NEW.quantity
        WHEN NEW.movement_type = 'out' THEN current_qty - NEW.quantity
      END,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.stock_id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_stock_movement_after_delete
    AFTER DELETE ON stock_movement
    BEGIN
      UPDATE stock 
      SET current_qty = CASE 
        WHEN OLD.movement_type = 'in' THEN current_qty - OLD.quantity
        WHEN OLD.movement_type = 'out' THEN current_qty + OLD.quantity
      END,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = OLD.stock_id;
    END;

    -- Trigger: Auto-create stock_movement OUT when transaksi_items inserted
    CREATE TRIGGER IF NOT EXISTS trg_transaksi_items_after_insert
    AFTER INSERT ON transaksi_items
    BEGIN
      INSERT INTO stock_movement (stock_id, movement_type, quantity, reference_type, reference_id, unit_cost, total_cost, created_by)
      VALUES (
        NEW.stock_id,
        'out',
        NEW.qty,
        'transaksi',
        NEW.transaksi_id,
        0,  -- unit_cost akan diisi manual atau via job terpisah
        0,
        'system'
      );
    END;

    -- Trigger: Auto-create stock_movement IN when pembelian_items inserted
    CREATE TRIGGER IF NOT EXISTS trg_pembelian_items_after_insert
    AFTER INSERT ON pembelian_items
    BEGIN
      INSERT INTO stock_movement (stock_id, movement_type, quantity, reference_type, reference_id, unit_cost, total_cost, created_by)
      VALUES (
        NEW.stock_id,
        'in',
        NEW.qty,
        'pembelian',
        NEW.pembelian_id,
        NEW.unit_cost,
        NEW.subtotal,
        'system'
      );
    END;
  `);

  return db;
}

export async function closeDb() {
  const db = await getDb();
  await db.close();
}