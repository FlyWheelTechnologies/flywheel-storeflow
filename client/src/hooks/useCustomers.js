import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import { useActiveOrgId } from "./useActiveOrgId";
import { dataCache } from "../services/dataCache";
import { SyncService } from "../services/SyncService";

/**
 * Hook to fetch and manage customers for the active organization
 * Uses Stale-While-Revalidate (SWR) cache for instant 0ms loads and offline queuing.
 */
export function useCustomers() {
  const orgId = useActiveOrgId();
  const cached = dataCache.getCachedData('customers', orgId);
  const [customers, setCustomers] = useState(() => cached || []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    const unsubscribe = dataCache.subscribe('customers', orgId, (updatedCustomers) => {
      setCustomers(updatedCustomers);
      setLoading(false);
    });

    return unsubscribe;
  }, [orgId]);

  const fetchCustomers = useCallback(async (options = {}) => {
    if (!orgId) {
      setCustomers([]);
      setLoading(false);
      return [];
    }

    if (!dataCache.hasCachedData('customers', orgId)) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await dataCache.fetchWithSWR('customers', orgId, async () => {
        const { data, error } = await supabase
          .from('customer_stats')
          .select('*')
          .eq('organization_id', orgId)
          .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
      }, options);

      setCustomers(data);
      return data;
    } catch (err) {
      setError(err.message);
      const fallback = dataCache.getCachedData('customers', orgId) || [];
      setCustomers(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const createCustomer = useCallback(async (customer) => {
    if (!orgId) throw new Error("No active organization");

    const now = new Date().toISOString();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline) {
      const localId = crypto.randomUUID();
      const localCustomer = {
        ...customer,
        id: localId,
        organization_id: orgId,
        created_at: now,
        sync_status: 'pending'
      };

      await SyncService.queueMutation('customers', 'INSERT', localCustomer);
      dataCache.setCachedData('customers', orgId, prev => [...(prev || []), localCustomer]);
      return localCustomer;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...customer, organization_id: orgId, created_at: now }])
        .select()
        .single();

      if (error) throw error;
      dataCache.setCachedData('customers', orgId, prev => [...(prev || []), data]);
      return data;
    } catch (err) {
      if (err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine) {
        console.warn("Network error during customer create; queuing for offline sync:", err.message);
        const localId = crypto.randomUUID();
        const localCustomer = {
          ...customer,
          id: localId,
          organization_id: orgId,
          created_at: now,
          sync_status: 'pending'
        };
        await SyncService.queueMutation('customers', 'INSERT', localCustomer);
        dataCache.setCachedData('customers', orgId, prev => [...(prev || []), localCustomer]);
        return localCustomer;
      }
      throw err;
    }
  }, [orgId]);

  const updateCustomer = useCallback(async (id, updates) => {
    const now = new Date().toISOString();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    dataCache.setCachedData('customers', orgId, prev => 
      (prev || []).map(c => c.id === id ? { ...c, ...updates, updated_at: now } : c)
    );

    if (!isOnline) {
      await SyncService.queueMutation('customers', 'UPDATE', { id, ...updates, updated_at: now });
      return { id, ...updates };
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      dataCache.setCachedData('customers', orgId, prev => 
        (prev || []).map(c => c.id === id ? data : c)
      );
      return data;
    } catch (err) {
      if (err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine) {
        console.warn("Network error during customer update; queuing for offline sync:", err.message);
        await SyncService.queueMutation('customers', 'UPDATE', { id, ...updates, updated_at: now });
        return { id, ...updates };
      }
      throw err;
    }
  }, [orgId]);

  const deleteCustomer = useCallback(async (id) => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    dataCache.setCachedData('customers', orgId, prev => (prev || []).filter(c => c.id !== id));

    if (!isOnline) {
      await SyncService.queueRpc('delete_customer_cascade', {
        p_customer_id: id,
        p_organization_id: orgId || null
      });
      return;
    }

    try {
      const { error: rpcError } = await supabase.rpc('delete_customer_cascade', {
        p_customer_id: id,
        p_organization_id: orgId || null
      });

      if (rpcError) {
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) throw error;
      }
    } catch (err) {
      if (err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine) {
        console.warn("Network error during customer delete; queuing for offline sync:", err.message);
        await SyncService.queueRpc('delete_customer_cascade', {
          p_customer_id: id,
          p_organization_id: orgId || null
        });
        return;
      }
      throw err;
    }
  }, [orgId]);

  return {
    customers,
    loading,
    error,
    refetch: (opts) => fetchCustomers({ force: true, ...opts }),
    createCustomer,
    updateCustomer,
    deleteCustomer
  };
}
