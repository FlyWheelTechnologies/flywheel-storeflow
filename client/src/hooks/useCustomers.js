import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import { useActiveOrgId } from "./useActiveOrgId";

/**
 * Hook to fetch and manage customers for the active organization
 * Uses the customer_stats view for aggregated data
 */
export function useCustomers() {
  const orgId = useActiveOrgId();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCustomers = useCallback(async () => {
    if (!orgId) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('customer_stats')
        .select('*')
        .eq('organization_id', orgId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch customers:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const createCustomer = useCallback(async (customer) => {
    if (!orgId) throw new Error("No active organization");

    const { data, error } = await supabase
      .from('customers')
      .insert([{ ...customer, organization_id: orgId, created_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) throw error;
    setCustomers(prev => [...prev, data]);
    return data;
  }, [orgId]);

  const updateCustomer = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setCustomers(prev => prev.map(c => c.id === id ? data : c));
    return data;
  }, []);

  const deleteCustomer = useCallback(async (id) => {
    // Attempt cascade delete via RPC first (deletes customer and all associated sales, items, and journal entries)
    const { error: rpcError } = await supabase.rpc('delete_customer_cascade', {
      p_customer_id: id,
      p_organization_id: orgId || null
    });

    if (rpcError) {
      console.warn("delete_customer_cascade RPC failed, attempting direct table delete:", rpcError.message);
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    }

    setCustomers(prev => prev.filter(c => c.id !== id));
  }, [orgId]);

  return {
    customers,
    loading,
    error,
    refetch: fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer
  };
}