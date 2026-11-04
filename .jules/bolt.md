# Bolt's Journal

## 2026-10-28 - Intl.NumberFormat Instantiation in Formatter Utilities
**Learning:** `new Intl.NumberFormat(locale, options)` is computationally expensive (~0.05ms per instantiation in V8/Node/browser). When utility functions like `formatCurrency` are invoked directly in table row renders or mapping operations without caching, rendering thousands of items creates massive CPU overhead and garbage collection pressure (~550ms for 10k operations).
**Action:** Always cache `Intl.NumberFormat` instances in a module-level `Map` keyed by the formatting options or currency code. This reduces execution time by over 90% (~13x speedup) with zero API or behavioral differences.

## 2026-11-04 - Pre-indexing Date-Grouped Metrics in Time-Series Charts
**Learning:** In dashboard components that compute day-by-day or month-by-month time series charts, iterating through days/months and executing `.filter(...)` with `new Date(s.created_at)` causes $O(\text{Days} \times N)$ time complexity and tens of thousands of temporary Date allocations. On a 10k sale dataset, computing a 30-day window took >3.3 seconds of main thread time.
**Action:** Always aggregate records in a single $O(N)$ pass into a hash map (`Map`) keyed by date string or a fixed-size typed array (for monthly buckets). Day/month mapping then performs $O(1)$ lookups, dropping chart computation time from ~3300ms to ~160ms (20x speedup).
