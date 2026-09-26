# Bolt's Journal - Critical Learnings

## 2025-05-18 - Dashboard Revenue Chart Map Aggregation
**Learning:** `chartData` in `Dashboard.jsx` was calculating 7 or 30 days of revenue/expenses by calling `.filter(...).reduce(...)` on every array element for every single day slot, leading to $O(N \cdot M)$ complexity. On large datasets, this slowed down rendering during timeframe switches or state updates. Pre-aggregating sales and expenses into a `Map` keyed by `toDateString()` reduces complexity to $O(N + M)$, speeding up chart generation by ~25x.
**Action:** Always pre-aggregate timeseries data into a map or dictionary when building multi-day chart series instead of iterating the entire dataset inside a `.map()` callback.
