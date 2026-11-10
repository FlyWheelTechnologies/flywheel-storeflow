import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import { useActiveOrgId } from "./useActiveOrgId";
import { dataCache } from "../services/dataCache";
import { SyncService } from "../services/SyncService";

/**
 * Hook to fetch and manage expenses for the active organization
 * Uses Stale-While-Revalidate (SWR) cache for instant 0ms loads and offline queuing.
 */
export function useExpenses() {
  const orgId = useActiveOrgId();
  const cached = dataCache.getCachedData('expenses', orgId);
  const [expenses, setExpenses] = useState(() => cached || []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    const unsubscribe = dataCache.subscribe('expenses', orgId, (updatedExpenses) => {
      setExpenses(updatedExpenses);
      setLoading(false);
    });

    return unsubscribe;
  }, [orgId]);

  const fetchExpenses = useCallback(async (options = {}) => {
    if (!orgId) {
      setExpenses([]);
      setLoading(false);
      return [];
    }

    if (!dataCache.hasCachedData('expenses', orgId)) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await dataCache.fetchWithSWR('expenses', orgId, async () => {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      }, options);

      setExpenses(data);
      return data;
    } catch (err) {
      setError(err.message);
      const fallback = dataCache.getCachedData('expenses', orgId) || [];
      setExpenses(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const createExpense = useCallback(async (expense) => {
    if (!orgId) throw new Error("No active organization");

    const now = new Date().toISOString();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline) {
      const localId = crypto.randomUUID();
      const localExpense = {
        ...expense,
        id: localId,
        organization_id: orgId,
        created_at: now,
        sync_status: 'pending'
      };

      await SyncService.queueMutation('expenses', 'INSERT', localExpense);
      dataCache.setCachedData('expenses', orgId, prev => [localExpense, ...(prev || [])]);
      return localExpense;
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([{ ...expense, organization_id: orgId, created_at: now }])
        .select()
        .single();

      if (error) throw error;
      dataCache.setCachedData('expenses', orgId, prev => [data, ...(prev || [])]);
      return data;
    } catch (err) {
      if (err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine) {
        console.warn("Network error during expense create; falling back to offline queue:", err.message);
        const localId = crypto.randomUUID();
        const localExpense = {
          ...expense,
          id: localId,
          organization_id: orgId,
          created_at: now,
          sync_status: 'pending'
        };
        await SyncService.queueMutation('expenses', 'INSERT', localExpense);
        dataCache.setCachedData('expenses', orgId, prev => [localExpense, ...(prev || [])]);
        return localExpense;
      }
      throw err;
    }
  }, [orgId]);

  return {
    expenses,
    loading,
    error,
    refetch: (opts) => fetchExpenses({ force: true, ...opts }),
    createExpense
  };
}
