# StoreFlow Critical Bugfix & Ghana Compliance Sprint

## Phase 0: Security & Repository Sanitization
- [x] 0.1 Sanitize `fix_notify_deposit_trigger.sql` (remove leaked JWT token) <!-- id: 0.1 -->
- [x] 0.2 Update `.gitignore` to prevent committing sensitive trigger/credential SQL scripts <!-- id: 0.2 -->

## Phase 1: Database Hardening & Multi-Tenant Migration
- [x] 1.1 Create unified idempotent migration `supabase/migrations/20260903_critical_bugfixes.sql`: <!-- id: 1.1 -->
  - Drop all competing/legacy overloads of `record_sale_transaction`
  - Recreate `record_sale_transaction` with `SECURITY DEFINER`, `v_org_id := public.get_my_organization_id()`, explicit org_id on all inserts, tenant-scoped invoice sequence
  - Fix `fulfill_sale`: add `AND organization_id = public.get_my_organization_id()` check
  - Fix `fulfill_pure_deposit`: verify caller org matches sale org
  - Fix `record_pure_deposit`: add `LIMIT 1` to customer lookup
  - Create tenant-scoped views `public.deposits` and `public.customer_stats` with `WITH (security_invoker = true)`
  - Backfill orphaned `sales`, `sale_items`, and `journal_entries` where `organization_id IS NULL`
- [x] 1.2 Update `prodSupabaseDB.sql` with views and latest function definitions <!-- id: 1.2 -->

## Phase 2: Frontend CRUD & Sync Fixes
- [x] 2.1 Remove abolished "12.5% Flat Rate" option in `SalesForm.jsx` and display Act 1151 breakdown <!-- id: 2.1 -->
- [x] 2.2 Add `organization_id` to insert payloads in `Products.jsx` from `activeOrgId` / `user` <!-- id: 2.2 -->
- [x] 2.3 Add `organization_id` to insert payloads in `Customers.jsx` and normalize phone prefix <!-- id: 2.3 -->
- [x] 2.4 Add `organization_id`, try/catch error handling, and toast notifications in `Expenses.jsx` <!-- id: 2.4 -->
- [x] 2.5 Ensure offline sync in `SyncService.js` injects `organization_id` on pending inserts <!-- id: 2.5 -->

## Phase 3: Verification & Build Validation
- [x] 3.1 Run `npm run build` in `client` to verify zero frontend compilation errors <!-- id: 3.1 -->
- [x] 3.2 Verify SQL migration syntax and sanity <!-- id: 3.2 -->
- [x] 3.3 Create walkthrough artifact with execution details & dashboard instructions for the user <!-- id: 3.3 -->

## Phase 4: Compliance Sprint (P2+P3) & Landing Page Scale-Down
- [x] 4.1 Create migration `supabase/migrations/20260904_add_org_tax_settings.sql` (tin, is_vat_registered, default_tax_rate, default_tax_inclusive) <!-- id: 4.1 -->
- [x] 4.2 Update `AdminSettings.jsx` with Store & Tax Profile card to manage TIN, VAT status, and default tax rate <!-- id: 4.2 -->
- [x] 4.3 Update `SalesService.js` (PDF & WhatsApp receipts) to format TIN and Act 1151 tax breakdown <!-- id: 4.3 -->
- [x] 4.4 Scale down regulatory/tax compliance language on `LandingPage.jsx` and focus on speed, operations, and inventory <!-- id: 4.4 -->
- [/] 4.5 Verify build with `npm run build` <!-- id: 4.5 -->
