import { initDb, getDb, closeDb } from '@/lib/db/schema';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  try {
    console.log('Initializing database...');
    await initDb();
    const db = await getDb();

    const stockPath = '/root/workspaces/assisten-gerai-nino/data/stock.json';
    const stockData = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
    
    const stokHarian = stockData.stok_harian[0];
    const penggunaan = stokHarian.penggunaan;

    console.log(`Found ${penggunaan.length} transactions to migrate...`);

    for (const trans of penggunaan) {
      const invoiceId = trans.id_transaksi;
      
      const existing = await db.get('SELECT id FROM transaksi WHERE invoice_id = ?', [invoiceId]);
      if (existing) {
        console.log(`Skipping ${invoiceId} - already exists`);
        continue;
      }

      const consumableItems = trans.items.map((item: { nama: string; qty: number }) => 
        `${item.nama} (${item.qty})`
      ).join(',');

      const result = await db.run(
        `INSERT INTO transaksi (invoice_id, customer, waktu, phone, address, total, photo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          'Adit',
          stokHarian.tanggal + ' 00:00:00',
          'cash',
          'Gerai Nino (WIB)',
          10000,
          'https://images.pexels.com/photos/428328/pexels-photo-428328.jpeg?auto=compress&cs=tinysrgb&w=1200'
        ]
      );

      const transaksiId = result.lastID;

      for (const item of trans.items) {
        await db.run(
          `INSERT INTO transaksi_consumable (transaksi_id, consumable, qty) VALUES (?, ?, ?)`,
          [transaksiId, item.nama, item.qty]
        );
      }

      console.log(`Migrated ${invoiceId} with consumables: ${consumableItems}`);
    }

    console.log('Migration completed!');
    await closeDb();
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();