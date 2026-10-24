# Bolt's Journal - Critical Learnings

## 2025-05-18 - Single-Pass Aggregations for Sales & Financial Summaries
**Learning:** Filtering arrays multiple times (e.g. `sales.filter(...).reduce(...)`) in Dashboard and Journal rendering routines causes redundant O(N) array traversals on every render or dependency change. Aggregating values in a single `reduce` pass avoids multi-pass overhead.
**Action:** When computing summary metrics over arrays like `sales`, `products`, or `expenses`, combine filter and reduce criteria into a single loop / `reduce` pass.
