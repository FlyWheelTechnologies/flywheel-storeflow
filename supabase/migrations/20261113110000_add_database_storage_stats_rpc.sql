-- StoreFlow Migration: Add Database Storage & Health Telemetry RPC
-- Provides real PostgreSQL database size (MB), table bytes, index bytes, and live health metrics.

CREATE OR REPLACE FUNCTION public.get_database_storage_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_db_size bigint;
  v_table_stats jsonb;
BEGIN
  -- Verify super admin privileges
  IF NOT public.is_super_admin() AND NOT public.is_super_admin_jwt() THEN
    RAISE EXCEPTION 'Access denied. Super admin only.';
  END IF;

  -- 1. Exact kernel database storage size in bytes
  SELECT pg_database_size(current_database()) INTO v_db_size;

  -- 2. Relation and index breakdown per public table
  SELECT jsonb_agg(
    jsonb_build_object(
      'table_name', t.table_name,
      'total_bytes', pg_total_relation_size(quote_ident(t.table_name)),
      'table_bytes', pg_relation_size(quote_ident(t.table_name)),
      'index_bytes', pg_total_relation_size(quote_ident(t.table_name)) - pg_relation_size(quote_ident(t.table_name)),
      'row_count', (
        SELECT COALESCE(n_live_tup, 0)
        FROM pg_stat_user_tables 
        WHERE relname = t.table_name
      )
    )
  )
  INTO v_table_stats
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE';

  RETURN jsonb_build_object(
    'database_bytes', v_db_size,
    'tables', COALESCE(v_table_stats, '[]'::jsonb),
    'checked_at', now()
  );
END;
$$;

-- Grant execution to authenticated users (RLS & internal check secures execution)
GRANT EXECUTE ON FUNCTION public.get_database_storage_stats() TO authenticated;

