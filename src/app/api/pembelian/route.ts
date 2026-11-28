import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db/schema';

export async function GET() {
  try {
    await initDb();
    const db = await getDb();

    const pembelian = await db.all(`
      SELECT p.*, 
        GROUP_CONCAT(pi.item_name || ':' || pi.qty || ':' || pi.unit_cost || ':' || pi.subtotal) as items_list
      FROM pembelian p
      LEFT JOIN pembelian_items pi ON p.id = pi.pembelian_id
      GROUP BY p.id
      ORDER BY p.waktu DESC
    `);

    const result = pembelian.map((p: any) => ({
      id: p.id,
      invoice_id: p.invoice_id,
      supplier: p.supplier,
      waktu: p.waktu,
      total: p.total,
      status: p.status,
      note: p.note,
      items: p.items_list ? p.items_list.split(',').map((s: string) => {
        const [name, qty, cost, subtotal] = s.split(':');
        return { name, qty: parseInt(qty), unit_cost: parseInt(cost), subtotal: parseInt(subtotal) };
      }) : [],
    }));

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('GET /api/pembelian error:', error);
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { invoice_id, supplier, waktu, total, status, note, items } = body;

    if (!invoice_id || !supplier || !waktu || !total || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing required fields: invoice_id, supplier, waktu, total, items' }, { status: 400 });
    }

    await db.run('BEGIN TRANSACTION');

    try {
      const result = await db.run(
        `INSERT INTO pembelian (invoice_id, supplier, waktu, total, status, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoice_id, supplier, waktu, total, status || 'received', note || null]
      );

      const pembelianId = result.lastID;

      for (const item of items) {
        await db.run(
          `INSERT INTO pembelian_items (pembelian_id, stock_id, item_name, qty, unit_cost, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pembelianId, item.stock_id, item.name, item.qty, item.unit_cost, item.subtotal || (item.qty * item.unit_cost)]
        );
      }

      await db.run('COMMIT');
      return NextResponse.json({ id: pembelianId, invoice_id }, { status: 201 });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error: unknown) {
    console.error('POST /api/pembelian error:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Purchase invoice ID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { id, invoice_id, supplier, waktu, total, status, note, items } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const existing = await db.get('SELECT * FROM pembelian WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (invoice_id !== undefined) {
      updates.push('invoice_id = ?');
      params.push(invoice_id);
    }
    if (supplier !== undefined) {
      updates.push('supplier = ?');
      params.push(supplier);
    }
    if (waktu !== undefined) {
      updates.push('waktu = ?');
      params.push(waktu);
    }
    if (total !== undefined) {
      updates.push('total = ?');
      params.push(total);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (note !== undefined) {
      updates.push('note = ?');
      params.push(note);
    }

    if (updates.length === 0) {
      if (!items) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }
    }

    if (items && Array.isArray(items)) {
      await db.run('BEGIN TRANSACTION');
      try {
        const pembelianId = id;

        // Delete old items
        await db.run('DELETE FROM pembelian_items WHERE pembelian_id = ?', [pembelianId]);

        // Insert new items
        for (const item of items) {
          await db.run(
            `INSERT INTO pembelian_items (pembelian_id, stock_id, item_name, qty, unit_cost, subtotal)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [pembelianId, item.stock_id, item.name, item.qty, item.unit_cost, item.subtotal || (item.qty * item.unit_cost)]
          );
        }

        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      await db.run(
        `UPDATE pembelian SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('PATCH /api/pembelian error:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Purchase invoice ID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update purchase' }, { status: 500 });
  }
}