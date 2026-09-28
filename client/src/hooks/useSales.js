import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import { useActiveOrgId } from "./useActiveOrgId";

/**
 * Hook to fetch and manage sales for the active organization
 */
export function useSales() {
  const orgId = useActiveOrgId();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSales = useCallback(async () => {
    if (!orgId) {
      setSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch sales:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const recordSale = useCallback(async (params) => {
    const { data, error } = await supabase.rpc('record_sale_transaction', params);
    if (error) throw error;
    await fetchSales(); // Refresh after recording
    return data;
  }, [fetchSales]);

  return {
    sales,
    loading,
    error,
    refetch: fetchSales,
    recordSale
  };
}