import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const { searchParams } = new URL(req.url);
    const stockId = searchParams.get('stock_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const movementType = searchParams.get('movement_type');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = `
      SELECT sm.*, s.name as stock_name, s.category, s.type, s.unit
      FROM stock_movement sm
      JOIN stock s ON sm.stock_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (stockId) {
      query += ' AND sm.stock_id = ?';
      params.push(stockId);
    }
    if (startDate) {
      query += ' AND date(sm.waktu) >= date(?)';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date(sm.waktu) <= date(?)';
      params.push(endDate);
    }
    if (movementType) {
      query += ' AND sm.movement_type = ?';
      params.push(movementType);
    }

    query += ' ORDER BY sm.waktu DESC LIMIT ?';
    params.push(limit);

    const movements = await db.all(query, params);
    return NextResponse.json({ data: movements });
  } catch (error) {
    console.error('GET /api/stock/movement error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock movements' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { stock_id, movement_type, quantity, reference_type, reference_id, reference_note, unit_cost } = body;

    if (!stock_id || !movement_type || !quantity || !reference_type) {
      return NextResponse.json({ error: 'Missing required fields: stock_id, movement_type, quantity, reference_type' }, { status: 400 });
    }

    const stock = await db.get('SELECT current_qty, name FROM stock WHERE id = ?', [stock_id]);
    if (!stock) {
      return NextResponse.json({ error: 'Stock item not found' }, { status: 404 });
    }

    if (movement_type === 'out' && stock.current_qty < quantity) {
      return NextResponse.json({ error: `Stok tidak cukup: tersedia ${stock.current_qty}, butuh ${quantity}` }, { status: 400 });
    }

    const total_cost = quantity * (unit_cost || 0);

    const result = await db.run(
      `INSERT INTO stock_movement (stock_id, movement_type, quantity, reference_type, reference_id, reference_note, unit_cost, total_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [stock_id, movement_type, quantity, reference_type, reference_id || null, reference_note || null, unit_cost || 0, total_cost]
    );

    return NextResponse.json({ id: result.lastID }, { status: 201 });
  } catch (error) {
    console.error('POST /api/stock/movement error:', error);
    return NextResponse.json({ error: 'Failed to create stock movement' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { id, stock_id, movement_type, quantity, reference_type, reference_id, reference_note, unit_cost } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const existing = await db.get('SELECT * FROM stock_movement WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Stock movement not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (stock_id !== undefined) {
      updates.push('stock_id = ?');
      params.push(stock_id);
    }
    if (movement_type !== undefined) {
      updates.push('movement_type = ?');
      params.push(movement_type);
    }
    if (quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(quantity);
    }
    if (reference_type !== undefined) {
      updates.push('reference_type = ?');
      params.push(reference_type);
    }
    if (reference_id !== undefined) {
      updates.push('reference_id = ?');
      params.push(reference_id);
    }
    if (reference_note !== undefined) {
      updates.push('reference_note = ?');
      params.push(reference_note);
    }
    if (unit_cost !== undefined) {
      updates.push('unit_cost = ?');
      params.push(unit_cost);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(
      `UPDATE stock_movement SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/stock/movement error:', error);
    return NextResponse.json({ error: 'Failed to update stock movement' }, { status: 500 });
  }
}