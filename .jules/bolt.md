# Bolt's Journal

## 2026-10-28 - Intl.NumberFormat Instantiation in Formatter Utilities
**Learning:** `new Intl.NumberFormat(locale, options)` is computationally expensive (~0.05ms per instantiation in V8/Node/browser). When utility functions like `formatCurrency` are invoked directly in table row renders or mapping operations without caching, rendering thousands of items creates massive CPU overhead and garbage collection pressure (~550ms for 10k operations).
**Action:** Always cache `Intl.NumberFormat` instances in a module-level `Map` keyed by the formatting options or currency code. This reduces execution time by over 90% (~13x speedup) with zero API or behavioral differences.

## 2026-10-29 - Time-Series Bucket Aggregation with Pre-Grouped Lookups
**Learning:** Iterating large datasets repeatedly inside time-series bucket loops (e.g. `Array.from({ length: 30 }).map(() => dataset.filter(...).reduce(...))`) scales as O(buckets * n), performing redundant `new Date()` parses and string conversions across every bucket iteration (60 iterations over sales and expenses for 30d, 24 for YoY). On 10k items, this causes ~450ms blocking main thread time on tab switch.
**Action:** Always group datasets in a single O(n) pass into a `Map` keyed by `toDateString()` or a typed array (`Float64Array(12)` for monthly YoY) before generating buckets. Downstream bucketing then does O(1) lookups, dropping execution time by ~18x (~450ms -> ~24ms) while keeping memoization pure.
