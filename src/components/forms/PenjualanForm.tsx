"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface PenjualanItem {
  stock_id?: number;
  name: string;
  category: string;
  type: "stock" | "non-stock";
  qty: number;
  unit_price: number;
}

interface PenjualanFormProps {
  type: "create" | "update";
  data?: {
    id: number;
    invoiceId: string;
    customer: string;
    waktu: string;
    phone: string;
    payment_method: string;
    address: string;
    total: number;
    photo: string | null;
    status: string;
    updated_at: string;
    items: PenjualanItem[];
    _expectedUpdatedAt?: string;
  };
  onSuccess?: () => void;
}

const PAYMENT_METHODS = ["QRIS", "Cash", "ShopeePay", "Dana", "GoPay"] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

export default function PenjualanForm({ type, data, onSuccess }: PenjualanFormProps) {
  const [customer, setCustomer] = useState(data?.customer || "");
  const [phone, setPhone] = useState(data?.phone || "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((data?.payment_method as PaymentMethod) || "Cash");
  const [address, setAddress] = useState(data?.address || "");
  const [photo, setPhoto] = useState(data?.photo || "");
  const [status, setStatus] = useState(data?.status || "completed");
  const [items, setItems] = useState<PenjualanItem[]>(data?.items || [{ name: "", category: "produk", type: "stock", qty: 1, unit_price: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For update: include _expectedUpdatedAt for concurrency check
  const expectedUpdatedAt = data?._expectedUpdatedAt;

  const addItem = () => {
    setItems([...items, { name: "", category: "produk", type: "stock", qty: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PenjualanItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Validate
    const validItems = items.filter(item => item.name && item.qty > 0 && item.unit_price > 0);
    if (validItems.length === 0) {
      setError("Minimal 1 produk harus diisi");
      setSubmitting(false);
      return;
    }
    if (!customer || !phone || !address) {
      setError("Customer, Phone, dan Alamat wajib diisi");
      setSubmitting(false);
      return;
    }

    const total = calculateTotal();
    const invoiceId = data?.invoiceId || `TX-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-4)}`;

    const payload: any = {
      invoiceId,
      customer,
      waktu: new Date().toISOString().slice(0, 19).replace("T", " "),
      phone,
      payment_method: paymentMethod,
      address,
      total,
      photo: photo || null,
      items: validItems.map(item => ({
        stock_id: item.stock_id || null,
        name: item.name,
        category: item.category,
        type: item.type,
        qty: item.qty,
        unit_price: item.unit_price,
      })),
    };

    if (type === "update" && data?.id) {
      payload.id = data.id;
      payload.status = status;
      if (expectedUpdatedAt) {
        payload._expectedUpdatedAt = expectedUpdatedAt;
      }
    }

    try {
      const url = type === "create" ? "/api/penjualan" : `/api/penjualan/${data!.id}`;
      const method = type === "create" ? "POST" : "PATCH";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      
      if (!res.ok) {
        if (res.status === 409 && result.error === "CONFLICT") {
          setError(result.message || "Data sudah diubah oleh user lain. Refresh dan coba lagi.");
          // Optionally update form with server data
          if (result.serverData) {
            setCustomer(result.serverData.customer);
            setPhone(result.serverData.phone);
            setPaymentMethod(result.serverData.payment_method as PaymentMethod);
            setAddress(result.serverData.address);
            setStatus(result.serverData.status);
          }
        } else {
          setError(result.error || "Gagal menyimpan data");
        }
        setSubmitting(false);
        return;
      }

      onSuccess?.();
    } catch (err) {
      setError("Network error: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
      <h2 className="text-lg font-semibold text-center">
        {type === "create" ? "Tambah Penjualan" : "Edit Penjualan"}
      </h2>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Customer</label>
        <input
          type="text"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Phone / Kontak</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Metode Pembayaran</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className="border border-gray-300 rounded px-3 py-2"
        >
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Alamat / Gerai</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        >
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium">Produk</label>
          <button type="button" onClick={addItem} className="text-xs text-lamaPurple hover:underline">
            + Tambah Produk
          </button>
        </div>
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 mb-2 p-2 bg-gray-50 rounded">
            <div className="col-span-12 md:col-span-4">
              <input
                type="text"
                placeholder="Nama Produk"
                value={item.name}
                onChange={(e) => updateItem(index, "name", e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
              />
            </div>
            <div className="col-span-12 md:col-span-2">
              <select
                value={item.category}
                onChange={(e) => updateItem(index, "category", e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
              >
                <option value="produk">Produk</option>
                <option value="jasa">Jasa</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>
            <div className="col-span-12 md:col-span-2">
              <select
                value={item.type}
                onChange={(e) => updateItem(index, "type", e.target.value as "stock" | "non-stock")}
                className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
              >
                <option value="stock">Stock</option>
                <option value="non-stock">Non-Stock</option>
              </select>
            </div>
            <div className="col-span-12 md:col-span-2">
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={item.qty}
                onChange={(e) => updateItem(index, "qty", parseInt(e.target.value) || 0)}
                className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
              />
            </div>
            <div className="col-span-12 md:col-span-2">
              <input
                type="number"
                min="0"
                placeholder="Harga"
                value={item.unit_price}
                onChange={(e) => updateItem(index, "unit_price", parseInt(e.target.value) || 0)}
                className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
              />
            </div>
            {items.length > 1 && (
              <div className="col-span-12 md:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-red-500 hover:underline text-sm"
                >
                  Hapus
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="text-right font-medium text-lg">
          Total: Rp {calculateTotal().toLocaleString()}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Foto (URL)</label>
        <input
          type="url"
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="bg-gray-200 text-gray-800 py-2 px-4 rounded-md"
          disabled={submitting}
        >
          Batal
        </button>
        <button
          type="submit"
          className="bg-lamaYellow text-white py-2 px-4 rounded-md"
          disabled={submitting}
        >
          {submitting ? "Menyimpan..." : type === "create" ? "Simpan" : "Update"}
        </button>
      </div>
    </form>
  );
}