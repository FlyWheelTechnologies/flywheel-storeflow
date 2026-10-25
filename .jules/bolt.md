## 2025-10-25 - Avoid O(N*K) date string filters in chart data aggregation

**Learning:** Computing chart series data by filtering raw sales/expenses arrays inside a loop for each chart tick (e.g. 30 days or 12 months) creates O(N * K) time complexity and generates tens of thousands of temporary `Date` and String objects during render calculations.
**Action:** Pre-map target date buckets into a `Map` or Array, then iterate through sales and expenses in a single O(N + M) pass to accumulate values into the date buckets.
