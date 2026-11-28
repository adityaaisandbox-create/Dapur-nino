"use client";

import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import DateRangePicker from "@/components/DateRangePicker";
import { role } from "@/lib/data";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePenjualan, type Penjualan, type PenjualanItem } from "@/hooks/usePenjualan";

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
    header: "Payment",
    accessor: "payment_method",
    className: "hidden lg:table-cell",
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
    header: "Status",
    accessor: "status",
    className: "hidden lg:table-cell",
  },
  {
    header: "Actions",
    accessor: "action",
  },
];

const PenjualanListPage = () => {
  const { data: penjualanData, loading, error, refresh } = usePenjualan(30000);

  const renderRow = (item: Penjualan) => {
    const products = item.items.map((i) => `${i.name} (${i.qty})`);
    const paymentLabel = item.payment_method || "Cash";
    
    return (
      <tr
        key={item.id}
        className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
      >
        <td className="flex items-center gap-4 p-4">
          {item.photo && (
            <Image
              src={item.photo}
              alt=""
              width={40}
              height={40}
              className="md:hidden xl:block w-10 h-10 rounded-full object-cover"
            />
          )}
          <div className="flex flex-col">
            <h3 className="font-semibold">{item.customer}</h3>
            <p className="text-xs text-gray-500">{item.waktu}</p>
          </div>
        </td>
        <td className="hidden md:table-cell">{item.invoiceId}</td>
        <td className="hidden md:table-cell">{products.join(", ")}</td>
        <td className="hidden lg:table-cell">
          <span className="px-2 py-1 text-xs rounded-full bg-lamaSky/20 text-lamaSky font-medium">
            {paymentLabel}
          </span>
        </td>
        <td className="hidden lg:table-cell">{item.phone}</td>
        <td className="hidden lg:table-cell">Rp {item.total.toLocaleString()}</td>
        <td className="hidden lg:table-cell">
          <span className={`px-2 py-1 text-xs rounded-full ${
            item.status === "completed" ? "bg-green-100 text-green-700" :
            item.status === "cancelled" ? "bg-red-100 text-red-700" :
            "bg-yellow-100 text-yellow-700"
          }`}>
            {item.status}
          </span>
        </td>
        <td>
          <div className="flex items-center gap-2">
            <Link href={`/list/penjualan/${item.id}`}>
              <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky">
                <Image src="/view.png" alt="" width={16} height={16} />
              </button>
            </Link>
            {role === "admin" && (
              <>
                <FormModal 
                  table="penjualan" 
                  type="update" 
                  data={{ ...item, _expectedUpdatedAt: item.updated_at }} 
                />
                <FormModal table="penjualan" type="delete" id={item.id} />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // Pagination & Date Filter logic
  const [startDate, setStartDate] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    return today;
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    return today;
  });
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filteredData = penjualanData.filter((item) => {
    const itemDate = item.waktu.split(" ")[0];
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    return true;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when date filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-lamaPurple border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
        <div className="flex items-center justify-center h-64 text-red-500">
          <p>Error loading data: {error}</p>
          <button onClick={refresh} className="ml-4 px-4 py-2 bg-lamaPurple text-white rounded">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold">Semua Penjualan</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-2 self-end">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
            />
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            {role === "admin" && (
              <FormModal table="penjualan" type="create" onSuccess={refresh} />
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
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(val) => {
          setItemsPerPage(val);
          setCurrentPage(1);
        }}
      />
    </div>
  );
};

export default PenjualanListPage;