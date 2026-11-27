"use client";

import { useState, useRef, useEffect } from "react";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  placeholder?: string;
}

const DateRangePicker = ({
  startDate,
  endDate,
  onChange,
  placeholder = "Pilih rentang tanggal",
}: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = startDate ? new Date(startDate) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getDaysInMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  };

  const isInRange = (date: Date) => {
    if (!tempStart || !tempEnd) return false;
    const d = formatDate(date);
    return d >= tempStart && d <= tempEnd;
  };

  const isStartDate = (date: Date) => tempStart && formatDate(date) === tempStart;
  const isEndDate = (date: Date) => tempEnd && formatDate(date) === tempEnd;

  const handleDayClick = (date: Date) => {
    const d = formatDate(date);
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(d);
      setTempEnd("");
    } else if (d < tempStart) {
      setTempStart(d);
    } else {
      setTempEnd(d);
    }
  };

  const applyRange = () => {
    if (tempStart) {
      onChange(tempStart, tempEnd);
    }
    setIsOpen(false);
  };

  const clearRange = () => {
    onChange("", "");
    setTempStart("");
    setTempEnd("");
    setIsOpen(false);
  };

  const prevMonth = () => {
    setViewMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }));
  };
  const nextMonth = () => {
    setViewMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }));
  };

  const monthName = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const displayValue = startDate && endDate
    ? `${formatDisplay(startDate)} - ${formatDisplay(endDate)}`
    : startDate
    ? `${formatDisplay(startDate)}`
    : placeholder;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-72 lg:w-80 px-3 py-2 text-left border border-gray-300 rounded bg-white text-sm text-gray-700 placeholder:text-gray-400 hover:border-lamaPurple focus:outline-none focus:ring-2 focus:ring-lamaPurple/50 flex items-center justify-between gap-2"
      >
        <span>{displayValue}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60 text-gray-600">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 min-w-[560px]">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100" aria-label="Bulan sebelumnya">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="font-medium text-sm capitalize">{monthName}</span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100" aria-label="Bulan berikutnya">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[-1, 0].map((offset) => {
              const m = viewMonth.month + offset;
              const y = viewMonth.year + Math.floor(m / 12);
              const adjMonth = ((m % 12) + 12) % 12;
              const days = getDaysInMonth(y, adjMonth);
              const label = new Date(y, adjMonth, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
              return (
                <div key={offset} className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 text-center">{label}</div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
                      <div key={d} className="text-gray-400 font-medium py-1">{d}</div>
                    ))}
                    {days.map((date, i) =>
                      date ? (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleDayClick(date)}
                          onMouseEnter={() => setHoveredDate(formatDate(date))}
                          onMouseLeave={() => setHoveredDate(null)}
                          className={`w-8 h-8 rounded mx-auto relative ${
                            isInRange(date)
                              ? "bg-lamaPurpleLight text-lamaPurple"
                              : "hover:bg-gray-100"
                          } ${isStartDate(date) || isEndDate(date) ? "bg-lamaPurple text-white font-bold" : ""} ${
                            date.getDay() === 0 ? "text-red-500" : ""
                          }`}
                        >
                          {date.getDate()}
                          {isStartDate(date) && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px]">Dari</span>}
                          {isEndDate(date) && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px]">Sampai</span>}
                        </button>
                      ) : (
                        <div key={i} className="w-8 h-8" />
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
            {(tempStart || tempEnd) && (
              <button
                type="button"
                onClick={clearRange}
                className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded"
              >
                Hapus
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={applyRange}
              disabled={!tempStart}
              className="px-3 py-1.5 text-xs bg-lamaPurple text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-lamaPurple/90"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;