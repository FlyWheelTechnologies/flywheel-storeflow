import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import { useActiveOrgId } from "./useActiveOrgId";
import { dataCache } from "../services/dataCache";
import { SyncService } from "../services/SyncService";

/**
 * Hook to fetch and manage products for the active organization
 * Uses Stale-While-Revalidate (SWR) cache for instant 0ms loads and offline queuing.
 */
export function useProducts() {
  const orgId = useActiveOrgId();
  const cached = dataCache.getCachedData('products', orgId);
  const [products, setProducts] = useState(() => cached || []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState(null);

  // Sync state whenever cache updates (from background revalidation or other tabs/hooks)
  useEffect(() => {
    if (!orgId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    // Subscribe to cache changes
    const unsubscribe = dataCache.subscribe('products', orgId, (updatedProducts) => {
      setProducts(updatedProducts);
      setLoading(false);
    });

    return unsubscribe;
  }, [orgId]);

  const fetchProducts = useCallback(async (options = {}) => {
    if (!orgId) {
      setProducts([]);
      setLoading(false);
      return [];
    }

    // Only display full loading state if we have literally no cached data
    if (!dataCache.hasCachedData('products', orgId)) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await dataCache.fetchWithSWR('products', orgId, async () => {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      }, options);

      setProducts(data);
      return data;
    } catch (err) {
      setError(err.message);
      // If offline or network fail, use whatever is already cached
      const fallback = dataCache.getCachedData('products', orgId) || [];
      setProducts(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const createProduct = useCallback(async (product) => {
    if (!orgId) throw new Error("No active organization");

    const now = new Date().toISOString();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline) {
      // Offline mode: queue mutation and update cache optimistically
      const localId = crypto.randomUUID();
      const localProduct = {
        ...product,
        id: localId,
        organization_id: orgId,
        created_at: now,
        sync_status: 'pending'
      };

      await SyncService.queueMutation('products', 'INSERT', localProduct);
      dataCache.setCachedData('products', orgId, prev => [localProduct, ...(prev || [])]);
      return localProduct;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{ ...product, organization_id: orgId, created_at: now }])
        .select()
        .single();

      if (error) throw error;
      dataCache.setCachedData('products', orgId, prev => [data, ...(prev || [])]);
      return data;
    } catch (err) {
      // Network drop or connection failure: fallback to offline queue
      if (err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine) {
        console.warn("Network error during product create; falling back to offline queue:", err.message);
        const localId = crypto.randomUUID();
        const localProduct = {
          ...product,
          id: localId,
          organization_id: orgId,
          created_at: now,
          sync_status: 'pending'
        };
        await SyncService.queueMutation('products', 'INSERT', localProduct);
        dataCache.setCachedData('products', orgId, prev => [localProduct, ...(prev || [])]);
        return localProduct;
      }
      throw err;
    }
  }, [orgId]);

  const updateProduct = useCallback(async (id, updates) => {
    const now = new Date().toISOString();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Optimistic cache update
    dataCache.setCachedData('products', orgId, prev => 
      (prev || []).map(p => p.id === id ? { ...p, ...updates, updated_at: now } : p)
    );

    if (!isOnline) {
      await SyncService.queueMutation('products', 'UPDATE', { id, ...updates, updated_at: now });
      return { id, ...updates };
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      dataCache.setCachedData('products', orgId, prev => 
        (prev || []).map(p => p.id === id ? data : p)
      );
      return data;
    } catch (err) {
      if (err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine) {
        console.warn("Network error during product update; falling back to offline queue:", err.message);
        await SyncService.queueMutation('products', 'UPDATE', { id, ...updates, updated_at: now });
        return { id, ...updates };
      }
      throw err;
    }
  }, [orgId]);

  const deleteProduct = useCallback(async (id) => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Optimistically remove from cache
    dataCache.setCachedData('products', orgId, prev => (prev || []).filter(p => p.id !== id));

    if (!isOnline) {
      await SyncService.queueMutation('products', 'DELETE', { id });
      return;
    }

    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      if (err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine) {
        console.warn("Network error during product delete; falling back to offline queue:", err.message);
        await SyncService.queueMutation('products', 'DELETE', { id });
        return;
      }
      throw err;
    }
  }, [orgId]);

  return {
    products,
    loading,
    error,
    refetch: (opts) => fetchProducts({ force: true, ...opts }),
    createProduct,
    updateProduct,
    deleteProduct
  };
}
