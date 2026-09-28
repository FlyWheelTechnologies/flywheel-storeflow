import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import { useActiveOrgId } from "./useActiveOrgId";

/**
 * Hook to fetch and manage expenses for the active organization
 */
export function useExpenses() {
  const orgId = useActiveOrgId();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchExpenses = useCallback(async () => {
    if (!orgId) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const createExpense = useCallback(async (expense) => {
    if (!orgId) throw new Error("No active organization");

    const { data, error } = await supabase
      .from('expenses')
      .insert([{ ...expense, organization_id: orgId, created_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) throw error;
    setExpenses(prev => [data, ...prev]);
    return data;
  }, [orgId]);

  return {
    expenses,
    loading,
    error,
    refetch: fetchExpenses,
    createExpense
  };
}