import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const stock = await db.all(`
      SELECT * FROM stock WHERE is_active = 1 ORDER BY category, type, name
    `);

    return NextResponse.json({ data: stock });
  } catch (error) {
    console.error('GET /api/stock error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { name, category, type, unit, current_qty, min_qty, harga_beli, harga_jual } = body;

    if (!name || !category || !type) {
      return NextResponse.json({ error: 'Missing required fields: name, category, type' }, { status: 400 });
    }

    const result = await db.run(
      `INSERT INTO stock (name, category, type, unit, current_qty, min_qty, harga_beli, harga_jual)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, type, unit || 'pcs', current_qty || 0, min_qty || 0, harga_beli || 0, harga_jual || 0]
    );

    return NextResponse.json({ id: result.lastID }, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/stock error:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Stock name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create stock item' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { id, name, category, type, unit, current_qty, min_qty, harga_beli, harga_jual, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const existing = await db.get('SELECT * FROM stock WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Stock item not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (unit !== undefined) {
      updates.push('unit = ?');
      params.push(unit);
    }
    if (current_qty !== undefined) {
      updates.push('current_qty = ?');
      params.push(current_qty);
    }
    if (min_qty !== undefined) {
      updates.push('min_qty = ?');
      params.push(min_qty);
    }
    if (harga_beli !== undefined) {
      updates.push('harga_beli = ?');
      params.push(harga_beli);
    }
    if (harga_jual !== undefined) {
      updates.push('harga_jual = ?');
      params.push(harga_jual);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(
      `UPDATE stock SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('PATCH /api/stock error:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Stock name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update stock item' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDb();
    const db = await getDb();

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const existing = await db.get('SELECT * FROM stock WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Stock item not found' }, { status: 404 });
    }

    await db.run('UPDATE stock SET is_active = 0 WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/stock error:', error);
    return NextResponse.json({ error: 'Failed to delete stock item' }, { status: 500 });
  }
}