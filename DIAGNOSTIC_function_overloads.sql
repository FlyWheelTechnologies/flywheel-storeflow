-- DIAGNOSTIC SCRIPT: Check all function overloads in the database

-- 1. Find ALL functions with multiple versions (function overloads)
SELECT 
  proname as "Function Name",
  COUNT(*) as "Version Count",
  array_agg(oid::regprocedure) as "All Versions"
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
GROUP BY proname
HAVING COUNT(*) > 1
ORDER BY proname;

-- 2. Detailed breakdown of each overloaded function
SELECT 
  p.proname,
  COUNT(*) as version_count,
  STRING_AGG(
    pg_catalog.format_type(p.prorettype, NULL) || ' ' ||
    pg_catalog.pg_get_function_identity_arguments(p.oid),
    E'\n---\n'
  ) as signatures
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
GROUP BY p.proname
HAVING COUNT(*) > 1
ORDER BY p.proname;

-- 3. Check specifically for these functions used in your app
SELECT 
  proname,
  COUNT(*) as version_count,
  array_agg(pg_get_functiondef(oid)) as definitions
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('record_sale_transaction', 'record_pure_deposit', 'fulfill_sale', 'fulfill_pure_deposit')
GROUP BY proname
ORDER BY proname;
