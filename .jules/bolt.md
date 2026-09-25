## 2026-05-11 - Pre-aggregate time-series chart data before range mapping
**Learning:** Filtering full sales/expense arrays inside daily or monthly loops for chart data generation causes O(K * N) operations and thousands of redundant `Date` object allocations per render.
**Action:** Pre-aggregate transactions into hash maps indexed by date or month strings in a single O(N) pass before mapping over chart range intervals.
