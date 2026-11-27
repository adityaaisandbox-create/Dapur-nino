"use client";

import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { role, penjualanData } from "@/lib/data";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type Penjualan = {
  id: number;
  invoiceId: string;
  customer: string;
  waktu: string;
  photo: string;
  phone: string;
  products: string[];
  categories: string[];
  address: string;
  total: number;
};

const columns = [
  {
    header: "Info",
    accessor: "info",
  },
  {
    header: "Invoice ID",
    accessor: "invoiceId",
    className: "hidden md:table-cell",
  },
  {
    header: "Produk",
    accessor: "products",
    className: "hidden md:table-cell",
  },
  {
    header: "Phone",
    accessor: "phone",
    className: "hidden lg:table-cell",
  },
  {
    header: "Total",
    accessor: "total",
    className: "hidden lg:table-cell",
  },
  {
    header: "Actions",
    accessor: "action",
  },
];

const PenjualanListPage = () => {
  const renderRow = (item: Penjualan) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
    >
      <td className="flex items-center gap-4 p-4">
        <Image
          src={item.photo}
          alt=""
          width={40}
          height={40}
          className="md:hidden xl:block w-10 h-10 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <h3 className="font-semibold">{item.customer}</h3>
          <p className="text-xs text-gray-500">{item.waktu}</p>
        </div>
      </td>
      <td className="hidden md:table-cell">{item.invoiceId}</td>
      <td className="hidden md:table-cell">{item.products.join(", ")}</td>
      <td className="hidden lg:table-cell">{item.phone}</td>
      <td className="hidden lg:table-cell">Rp {item.total.toLocaleString()}</td>
      <td>
        <div className="flex items-center gap-2">
          <Link href={`/list/penjualan/${item.id}`}>
            <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky">
              <Image src="/view.png" alt="" width={16} height={16} />
            </button>
          </Link>
          {role === "admin" && (
            <FormModal table="penjualan" type="delete" id={item.id} />
          )}
        </div>
      </td>
    </tr>
  );

  // Pagination logic
  const itemsPerPage = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(penjualanData.length / itemsPerPage);
  const paginatedData = penjualanData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold">Semua Penjualan</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            {role === "admin" && (
              <FormModal table="penjualan" type="create" />
            )}
          </div>
        </div>
      </div>
      {/* LIST */}
      <Table columns={columns} renderRow={renderRow} data={paginatedData} />
      {/* PAGINATION */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

export default PenjualanListPage;
