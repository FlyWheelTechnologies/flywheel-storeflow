import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import { useActiveOrgId } from "./useActiveOrgId";
import { dataCache } from "../services/dataCache";
import { SalesService } from "../services/SalesService";

/**
 * Hook to fetch and manage sales for the active organization
 * Uses Stale-While-Revalidate (SWR) cache for instant 0ms loads and offline queuing.
 */
export function useSales() {
  const orgId = useActiveOrgId();
  const cached = dataCache.getCachedData('sales', orgId);
  const [sales, setSales] = useState(() => cached || []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState(null);

  // Subscribe to cache updates (from background revalidation or new sales)
  useEffect(() => {
    if (!orgId) {
      setSales([]);
      setLoading(false);
      return;
    }

    const unsubscribe = dataCache.subscribe('sales', orgId, (updatedSales) => {
      setSales(updatedSales);
      setLoading(false);
    });

    return unsubscribe;
  }, [orgId]);

  const fetchSales = useCallback(async (options = {}) => {
    if (!orgId) {
      setSales([]);
      setLoading(false);
      return [];
    }

    if (!dataCache.hasCachedData('sales', orgId)) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await dataCache.fetchWithSWR('sales', orgId, async () => {
        const { data, error } = await supabase
          .from('sales')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      }, options);

      setSales(data);
      return data;
    } catch (err) {
      setError(err.message);
      const fallback = dataCache.getCachedData('sales', orgId) || [];
      setSales(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const recordSale = useCallback(async (params) => {
    const saleId = await SalesService.recordSaleTransaction({
      ...params,
      p_organization_id: params.p_organization_id || orgId
    });
    // Trigger background refresh
    fetchSales({ force: true, silent: true });
    return saleId;
  }, [orgId, fetchSales]);

  return {
    sales,
    loading,
    error,
    refetch: (opts) => fetchSales({ force: true, ...opts }),
    recordSale
  };
}
