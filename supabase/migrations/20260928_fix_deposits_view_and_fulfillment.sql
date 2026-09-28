-- ============================================================
-- Fix deposits view to count PARTIAL and UNPAID orders as pending
-- Also ensures the pending_sales_count accurately reflects all
-- orders that still need attention (not just DEPOSIT-status ones)
-- ============================================================

DROP VIEW IF EXISTS public.deposits;

CREATE OR REPLACE VIEW public.deposits WITH (security_invoker = true) AS
SELECT 
  c.id AS customer_id,
  c.name AS customer_name,
  c.phone,
  c.organization_id,
  COALESCE(COUNT(s.id) FILTER (
    WHERE (
      s.payment_status IN ('DEPOSIT', 'PARTIAL', 'UNPAID')
      OR s.notes ILIKE '%Pure Deposit%' 
      OR s.total_amount = 0 
      OR s.balance_due < 0
      OR s.balance_due > 0
    ) 
    AND (s.notes IS NULL OR s.notes NOT ILIKE '%(Fulfilled)%')
  ), 0)::integer AS pending_sales_count,
  MAX(s.created_at) AS last_sale_date,
  COALESCE(SUM(s.balance_due), 0)::numeric AS total_balance
FROM public.customers c
LEFT JOIN public.sales s ON s.customer_id = c.id AND s.organization_id = c.organization_id
GROUP BY c.id, c.name, c.phone, c.organization_id;

GRANT SELECT ON public.deposits TO authenticated, service_role;
