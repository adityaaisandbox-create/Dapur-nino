import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db/schema';

export async function GET() {
  try {
    await initDb();
    const db = await getDb();

    const harga = await db.all(`
      SELECT * FROM harga WHERE is_active = 1 ORDER BY nama
    `);

    return NextResponse.json({ data: harga });
  } catch (error) {
    console.error('GET /api/harga error:', error);
    return NextResponse.json({ error: 'Failed to fetch price list' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { nama, harga, satuan, isi, tipe } = body;

    if (!nama || harga === undefined || harga === null) {
      return NextResponse.json({ error: 'Missing required fields: nama, harga' }, { status: 400 });
    }

    const result = await db.run(
      `INSERT INTO harga (nama, harga, satuan, isi, tipe)
       VALUES (?, ?, ?, ?, ?)`,
      [nama, harga, satuan || 'pcs', isi || 1, tipe || 'stock']
    );

    return NextResponse.json({ id: result.lastID }, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/harga error:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Price entry with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create price entry' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { id, nama, harga, satuan, isi, tipe, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const existing = await db.get('SELECT * FROM harga WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Price entry not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (nama !== undefined) {
      updates.push('nama = ?');
      params.push(nama);
    }
    if (harga !== undefined) {
      updates.push('harga = ?');
      params.push(harga);
    }
    if (satuan !== undefined) {
      updates.push('satuan = ?');
      params.push(satuan);
    }
    if (isi !== undefined) {
      updates.push('isi = ?');
      params.push(isi);
    }
    if (tipe !== undefined) {
      updates.push('tipe = ?');
      params.push(tipe);
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
      `UPDATE harga SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('PATCH /api/harga error:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Price entry with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update price entry' }, { status: 500 });
  }
}