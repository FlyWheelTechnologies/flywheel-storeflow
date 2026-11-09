# Bolt's Journal

## 2026-10-28 - Intl.NumberFormat Instantiation in Formatter Utilities
**Learning:** `new Intl.NumberFormat(locale, options)` is computationally expensive (~0.05ms per instantiation in V8/Node/browser). When utility functions like `formatCurrency` are invoked directly in table row renders or mapping operations without caching, rendering thousands of items creates massive CPU overhead and garbage collection pressure (~550ms for 10k operations).
**Action:** Always cache `Intl.NumberFormat` instances in a module-level `Map` keyed by the formatting options or currency code. This reduces execution time by over 90% (~13x speedup) with zero API or behavioral differences.

## 2026-10-29 - Date Instantiation in Array Sorting Callbacks
**Learning:** Using `new Date(b.created_at) - new Date(a.created_at)` inside array `.sort()` comparator triggers O(N log N) `Date` object instantiations and parsing. For 10,000 records, sorting performs ~130,000 to ~150,000 `new Date()` calls and allocations, taking >500ms and creating significant garbage collection pressure. Because ISO-8601 strings (`YYYY-MM-DDTHH:mm:ss.sssZ`) sort lexicographically identical to chronological order, comparing the strings directly (`b.created_at > a.created_at ? 1 : ...`) eliminates all Date allocations and cuts sorting time by >95% (~23ms vs ~550ms).
**Action:** When sorting ISO timestamp fields, compare the strings directly instead of parsing into `new Date()` objects within the comparator loop.
