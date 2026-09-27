## 2025-05-18 - Aggregate chart metrics with O(N) Map lookups instead of nested filters
**Learning:** Computing timeframe metrics inside `Array.from` or `map` loops by calling `array.filter(...)` and `new Date(...)` on every iteration causes O(N * D) time complexity and unnecessary object allocations. Pre-aggregating data into a Map in a single pass reduces complexity to O(N + D) and cuts iterations/allocations by up to 30x.
**Action:** When aggregating time-series data for dashboard charts or reports, construct single-pass lookup maps before mapping over timeline intervals.
