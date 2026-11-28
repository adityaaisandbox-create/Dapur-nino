import { useState, useEffect, useCallback } from 'react';

export type PenjualanItem = {
  name: string;
  qty: number;
  unit_price: number;
  category: string;
  type: string;
};

export type Penjualan = {
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
};

export function usePenjualan(intervalMs = 30000) {
  const [data, setData] = useState<Penjualan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/penjualan');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json.data || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, intervalMs);
    return () => clearInterval(timer);
  }, [fetchData, intervalMs]);

  return { data, loading, error, refresh };
}