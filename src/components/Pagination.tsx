"use client";

const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
}: {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (value: number) => void;
}) => {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // If no onPageChange provided, render static pagination (backward compatible)
  if (!onPageChange) {
    return (
      <div className="p-4 flex items-center justify-between text-gray-500">
        <button
          disabled
          className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <div className="flex items-center gap-2 text-sm">
          <button className="px-2 rounded-sm bg-lamaSky">1</button>
        </div>
        <button
          disabled
          className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex items-center justify-between text-gray-500 flex-wrap gap-2">
      {itemsPerPage && onItemsPerPageChange && (
        <div className="flex items-center gap-2 hidden sm:flex">
          <label className="text-xs text-gray-500">Tampilkan</label>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-300"
        >
          Prev
        </button>
        <div className="flex items-center gap-2 text-sm">
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-2 rounded-sm ${
                page === currentPage
                  ? "bg-lamaSky text-white"
                  : "bg-slate-100 hover:bg-slate-200"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-300"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;
