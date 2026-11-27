"use client";

import { useState } from "react";
import Image from "next/image";

interface PenjualanFormProps {
  type: "create" | "update";
  data?: {
    id: number;
    invoiceId: string;
    customer: string;
    waktu: string;
    photo: string;
    phone: string;
    products: string[];
    categories: string[];
    address: string;
    consumable: string[];
    total: number;
  };
}

export default function PenjualanForm({ type, data }: PenjualanFormProps) {
  const [customer, setCustomer] = useState(data?.customer || "");
  const [phone, setPhone] = useState(data?.phone || "");
  const [products, setProducts] = useState(data?.products?.join("\n") || "");
  const [categories, setCategories] = useState(data?.categories?.join("\n") || "");
  const [address, setAddress] = useState(data?.address || "");
  const [consumabel_terpakai, setConsumabelTerpakai] = useState(data?.consumable?.join("\n") || "");
  const [total, setTotal] = useState(data?.total || 0);
  const [photo, setPhoto] = useState(data?.photo || "https://images.pexels.com/photos/2888150/pexels-photo-2888150.jpeg?auto=compress&cs=tinysrgb&w=1200");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = {
      customer,
      phone,
      products: products.split("\n").filter(Boolean),
      categories: categories.split("\n").filter(Boolean),
      address,
      consumable: consumabel_terpakai.split("\n").filter(Boolean),
      total,
      photo,
    };
    console.log("Submit:", { type, ...formData, id: data?.id });
    // TODO: API call to save data
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-center">
        {type === "create" ? "Tambah Penjualan" : "Edit Penjualan"}
      </h2>

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
        <label className="text-sm font-medium">Phone / Metode Bayar</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Produk (satu per baris)</label>
        <textarea
          value={products}
          onChange={(e) => setProducts(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 min-h-[80px]"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Kategori (satu per baris)</label>
        <textarea
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 min-h-[60px]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Alamat / Gerai</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Consumable Terpakai (satu per baris)</label>
        <textarea
          value={consumabel_terpakai}
          onChange={(e) => setConsumabelTerpakai(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 min-h-[60px]"
          placeholder="Contoh: Box\nTas\nPlastik"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Total (Rp)</label>
        <input
          type="number"
          value={total}
          onChange={(e) => setTotal(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Foto</label>
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
        >
          Batal
        </button>
        <button
          type="submit"
          className="bg-lamaYellow text-white py-2 px-4 rounded-md"
        >
          {type === "create" ? "Simpan" : "Update"}
        </button>
      </div>
    </form>
  );
}