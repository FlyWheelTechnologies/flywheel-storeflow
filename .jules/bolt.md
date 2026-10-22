## 2025-05-18 - Single-Pass Map Aggregation for Dashboard Chart Data
**Learning:** In React components calculating chart series over date ranges, using `.filter()` and `.reduce()` inside time-step iterations scales at O(K * N) where K is time buckets and N is record count. Pre-aggregating data into plain JS lookup objects in a single pass reduces complexity to O(N + K) and avoids repeated Date object instantiation.
**Action:** Always pre-aggregate datasets into a key-value lookup map before building date-bucketed chart arrays in React `useMemo` hooks.
