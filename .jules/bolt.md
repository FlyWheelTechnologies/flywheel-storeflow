## 2025-05-18 - Aggregate chart series data in a single pass
**Learning:** Filtering large transaction arrays repeatedly inside loops for date/time buckets in chart computations creates exponential $O(D \cdot (N + M))$ work and massive `Date` object garbage collection overhead during renders.
**Action:** Always pre-group time series collections using single-pass hash map aggregations ($O(N + M)$) prior to populating fixed chart date intervals ($O(D)$ lookups).
