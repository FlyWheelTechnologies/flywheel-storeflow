# Bolt's Journal - Performance Learnings

## 2025-05-20 - Dashboard Date Computations in Render Loop
**Learning:** In `Dashboard.jsx`, filtering sales and expenses inside `useMemo` by instantiating `new Date()` for every item on every render/state update causes noticeable re-computation overhead as sales data grows. Pre-formatting or normalizing date comparisons / optimizing `useMemo` dependencies keeps calculations fast and prevents unnecessary re-computation.
**Action:** Always memoize date-filtering transformations or minimize `new Date()` instantiations when dealing with large transaction sets.
