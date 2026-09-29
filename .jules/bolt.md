## 2026-05-11 - Pre-aggregating Time-Series Chart Data with Maps

**Learning:** Recharts components fed with dynamic timeframe state (`7d`, `30d`, `YoY`) often compute time series buckets by looping through array records and running `.filter(item => new Date(item.created_at)...)` per day/month. This results in $O(N \times (S + E))$ iterations and tens of thousands of `Date` object instantiations on every timeframe toggle. Pre-aggregating sales and expenses into a `Map` keyed by formatted date strings (`Date.toDateString()` or `YYYY-M`) reduces complexity to $O(S + E + N)$ single pass and eliminates $N \times (S + E)$ redundant `Date` object instantiations.

**Action:** Whenever building date-bucketed chart data from array props, create lookup `Map`s for sales and expenses in $O(S + E)$ time first, then populate time-series buckets via $O(1)$ key lookups.
