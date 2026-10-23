## 2025-05-18 - Single-Pass Filter & Hoisted Date Allocations in Table Views
**Learning:** Chaining `.filter()` calls and re-creating `new Date()` instances inside React `useMemo` filter predicates causes excessive garbage collection and intermediate array allocations on large list re-renders.
**Action:** Pre-calculate date boundaries and string search targets outside the `filter` callback and collapse chained `.filter()` predicates into a single pass.
