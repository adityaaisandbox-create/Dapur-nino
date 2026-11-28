import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db/schema';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDb();
    const db = await getDb();

    const { id } = params;
    const transaksi = await db.all(`
      SELECT t.*, 
        GROUP_CONCAT(ti.item_name || ':' || ti.qty || ':' || ti.unit_price || ':' || ti.category || ':' || ti.type) as items_list
      FROM transaksi t
      LEFT JOIN transaksi_items ti ON t.id = ti.transaksi_id
      WHERE t.id = ?
      GROUP BY t.id
    `, [id]);

    const result = transaksi.map((t: any) => ({
      id: t.id,
      invoice_id: t.invoice_id,
      customer: t.customer,
      waktu: t.waktu,
      phone: t.phone,
      payment_method: t.payment_method,
      address: t.address,
      total: t.total,
      photo: t.photo,
      status: t.status,
      updated_at: t.updated_at,
      items: t.items_list ? t.items_list.split(',').map((s: string) => {
        const [name, qty, price, category, type] = s.split(':');
        return { name, qty: parseInt(qty), unit_price: parseInt(price), category, type };
      }) : [],
    }));

    return NextResponse.json({ result });
  } catch (error) {
    console.error('GET /api/penjualan error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { invoiceId, customer, waktu, phone, payment_method, address, total, photo, items } = body;

    if (!invoiceId || !customer || !waktu || !phone || !address || !total || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing required fields: invoiceId, customer, waktu, phone, address, total, items' }, { status: 400 });
    }

    const validPaymentMethods = ['QRIS', 'Cash', 'ShopeePay', 'Dana', 'GoPay'];
    if (payment_method && !validPaymentMethods.includes(payment_method)) {
      return NextResponse.json({ error: 'Invalid payment_method. Must be one of: QRIS, Cash, ShopeePay, Dana, GoPay' }, { status: 400 });
    }

    // Validate stock availability for 'stock' type items
    for (const item of items) {
      if (item.type === 'stock' && item.stock_id) {
        const stock = await db.get('SELECT current_qty, name FROM stock WHERE id = ?', [item.stock_id]);
        if (!stock) {
          return NextResponse.json({ error: `Stock item not found: ${item.name}` }, { status: 400 });
        }
        if (stock.current_qty < item.qty) {
          return NextResponse.json({ error: `Stok tidak cukup untuk ${stock.name}: tersedia ${stock.current_qty}, butuh ${item.qty}` }, { status: 400 });
        }
      }
    }

    // Start transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Insert main transaction
      const result = await db.run(
        `INSERT INTO transaksi (invoice_id, customer, waktu, phone, payment_method, address, total, photo, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [invoiceId, customer, waktu, phone, payment_method || 'Cash', address, total, photo || null]
      );

      const transaksiId = result.lastID;

      // Insert transaction items
      for (const item of items) {
        await db.run(
          `INSERT INTO transaksi_items (transaksi_id, stock_id, item_name, category, type, qty, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transaksiId,
            item.stock_id ?? null,
            item.name,
            item.category || 'produk',
            item.type || 'stock',
            item.qty,
            item.unit_price || 0,
            item.subtotal || (item.qty * (item.unit_price || 0))
          ]
        );

        // Update stock for 'stock' type items
        if (item.type === 'stock' && item.stock_id) {
          await db.run(
            `INSERT INTO stock_movement (stock_id, movement_type, quantity, reference_type, reference_id, reference_note)
             VALUES (?, 'out', ?, 'penjualan', ?, 'Penjualan transaksi ${transaksiId}')`,
            [item.stock_id, item.qty, transaksiId]
          );

          await db.run(
            `UPDATE stock SET current_qty = current_qty - ? WHERE id = ?`,
            [item.qty, item.stock_id]
          );
        }
      }

      await db.run('COMMIT');
      return NextResponse.json({ id: transaksiId, invoiceId }, { status: 201 });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error: unknown) {
    console.error('POST /api/penjualan error:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Invoice ID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await initDb();
    const db = await getDb();

    const body = await req.json();
    const { id, invoiceId, customer, waktu, phone, payment_method, address, total, photo, status, items } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const validPaymentMethods = ['QRIS', 'Cash', 'ShopeePay', 'Dana', 'GoPay'];
    if (payment_method && !validPaymentMethods.includes(payment_method)) {
      return NextResponse.json({ error: 'Invalid payment_method. Must be one of: QRIS, Cash, ShopeePay, Dana, GoPay' }, { status: 400 });
    }

    const existing = await db.get('SELECT * FROM transaksi WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Concurrency check: compare updated_at timestamp
    const expectedUpdatedAt = body._expectedUpdatedAt;
    if (expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
      return NextResponse.json({ 
        error: 'CONFLICT', 
        message: 'Data sudah diubah oleh user lain. Silakan refresh halaman dan coba lagi.',
        serverData: {
          id: existing.id,
          invoice_id: existing.invoice_id,
          customer: existing.customer,
          waktu: existing.waktu,
          phone: existing.phone,
          payment_method: existing.payment_method,
          address: existing.address,
          total: existing.total,
          photo: existing.photo,
          status: existing.status,
          updated_at: existing.updated_at
        }
      }, { status: 409 });
    }

    // If changing to/from completed status, handle stock reversal first
    const oldStatus = existing.status;
    const newStatus = status || existing.status;
    if (oldStatus !== newStatus && newStatus === 'completed' && items && Array.isArray(items)) {
      await db.run('BEGIN TRANSACTION');
      try {
        // Reverse old items first
        const oldItems = await db.all('SELECT * FROM transaksi_items WHERE transaksi_id = ?', [id]);

        for (const oldItem of oldItems) {
          if (oldItem.type === 'stock' && oldItem.stock_id) {
            await db.run(
              `INSERT INTO stock_movement (stock_id, movement_type, quantity, reference_type, reference_id, reference_note)
               VALUES (?, 'in', ?, 'penjualan', ?, 'Reverse: Transaksi ${id}')`,
              [oldItem.stock_id, oldItem.qty, id]
            );

            await db.run(
              `UPDATE stock SET current_qty = current_qty + ? WHERE id = ?`,
              [oldItem.qty, oldItem.stock_id]
            );
          }
        }

        // Delete old items and insert new ones
        await db.run('DELETE FROM transaksi_items WHERE transaksi_id = ?', [id]);

        for (const item of items) {
          await db.run(
            `INSERT INTO transaksi_items (transaksi_id, stock_id, item_name, category, type, qty, unit_price, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              item.stock_id ?? null,
              item.name,
              item.category || 'produk',
              item.type || 'stock',
              item.qty,
              item.unit_price || 0,
              item.subtotal || (item.qty * (item.unit_price || 0))
            ]
          );

          // Insert real stock movement for new items
          if (item.type === 'stock' && item.stock_id) {
            await db.run(
              `INSERT INTO stock_movement (stock_id, movement_type, quantity, reference_type, reference_id, reference_note)
               VALUES (?, 'out', ?, 'penjualan', ?, 'Penjualan transaksi ${id}')`,
              [item.stock_id, item.qty, id]
            );

            await db.run(
              `UPDATE stock SET current_qty = current_qty - ? WHERE id = ?`,
              [item.qty, item.stock_id]
            );
          }
        }

        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }
    }

    // Update main transaction
    const updates: string[] = [];
    const params: any[] = [];

    if (invoiceId !== undefined) {
      updates.push('invoice_id = ?');
      params.push(invoiceId);
    }
    if (customer !== undefined) {
      updates.push('customer = ?');
      params.push(customer);
    }
    if (waktu !== undefined) {
      updates.push('waktu = ?');
      params.push(waktu);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (payment_method !== undefined) {
      updates.push('payment_method = ?');
      params.push(payment_method);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address);
    }
    if (total !== undefined) {
      updates.push('total = ?');
      params.push(total);
    }
    if (photo !== undefined) {
      updates.push('photo = ?');
      params.push(photo);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      await db.run(
        `UPDATE transaksi SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      if (newStatus === 'completed') {
        await db.run('BEGIN TRANSACTION');
        try {
          const oldItems = await db.all('SELECT * FROM transaksi_items WHERE transaksi_id = ?', [id]);

          for (const oldItem of oldItems) {
            if (oldItem.type === 'stock' && oldItem.stock_id) {
              await db.run(
                `INSERT INTO stock_movement (stock_id, movement_type, quantity, reference_type, reference_id, reference_note)
                 VALUES (?, 'in', ?, 'penjualan', ?, 'Reverse for update: Transaksi ${id}')`,
                [oldItem.stock_id, oldItem.qty, id]
              );

              await db.run(
                `UPDATE stock SET current_qty = current_qty + ? WHERE id = ?`,
                [oldItem.qty, oldItem.stock_id]
              );
            }
          }

          await db.run('DELETE FROM transaksi_items WHERE transaksi_id = ?', [id]);

          for (const item of items) {
            await db.run(
              `INSERT INTO transaksi_items (transaksi_id, stock_id, item_name, category, type, qty, unit_price, subtotal)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                id,
                item.stock_id ?? null,
                item.name,
                item.category || 'produk',
                item.type || 'stock',
                item.qty,
                item.unit_price || 0,
                item.subtotal || (item.qty * (item.unit_price || 0))
              ]
            );

            if (item.type === 'stock' && item.stock_id) {
              await db.run(
                `INSERT INTO stock_movement (stock_id, movement_type, quantity, reference_type, reference_id, reference_note)
                 VALUES (?, 'out', ?, 'penjualan', ?, 'Penjualan transaksi ${id} (update)')`,
                [item.stock_id, item.qty, id]
              );

              await db.run(
                `UPDATE stock SET current_qty = current_qty - ? WHERE id = ?`,
                [item.qty, item.stock_id]
              );
            }
          }

          await db.run('COMMIT');
        } catch (err) {
          await db.run('ROLLBACK');
          throw err;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('PATCH /api/penjualan error:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Invoice ID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
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

    const existing = await db.get('SELECT * FROM transaksi WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Only allow deletion if not completed
    if (existing.status === 'completed') {
      return NextResponse.json({ error: 'Cannot delete completed transaction without reversing stock first' }, { status: 400 });
    }

    await db.run('BEGIN TRANSACTION');
    try {
      // Delete transaction items and reverse stock
      const items = await db.all('SELECT * FROM transaksi_items WHERE transaksi_id = ?', [id]);

      for (const item of items) {
        if (item.type === 'stock' && item.stock_id) {
          await db.run(
            `INSERT INTO stock_movement (stock_id, movement_type, quantity, reference_type, reference_id, reference_note)
             VALUES (?, 'in', ?, 'penjualan', ?, 'Reverse deletion: Transaksi ${id}')`,
            [item.stock_id, item.qty, id]
          );

          await db.run(
            `UPDATE stock SET current_qty = current_qty + ? WHERE id = ?`,
            [item.qty, item.stock_id]
          );
        }
      }

      await db.run('DELETE FROM transaksi_items WHERE transaksi_id = ?', [id]);
      await db.run('DELETE FROM transaksi WHERE id = ?', [id]);
      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/penjualan error:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}