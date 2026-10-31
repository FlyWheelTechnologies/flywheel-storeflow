# Bolt Journal

Critical performance learnings and patterns discovered in StoreFlow.

## 2025-05-18 - Pre-aggregating Time-Series Buckets with Map Lookups
**Learning:** In dashboard components calculating multi-day (7d/30d) or multi-month (YoY) metrics, repeatedly executing `.filter()` and parsing `new Date(item.created_at)` for every day/month bucket turns calculation into an O(D * (N + M)) operation that takes upwards of 200ms when historical sales/expenses scale into thousands of records.
**Action:** Always pre-aggregate array items into a `Map` keyed by formatted date or year/month in a single O(N + M) pass, then perform O(1) lookups per bucket. This preserves UI responsiveness and cuts data crunching time by >90%.
