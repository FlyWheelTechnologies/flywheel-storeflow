## 2026-11-02 - Missing ARIA Labels on Close Buttons
**Learning:** The codebase has a recurring pattern of missing `aria-label` attributes on icon-only close buttons (e.g., in `ConfirmationModal.jsx`, `Layout.jsx`, `Dashboard.jsx`, and `Sales.jsx`).
**Action:** When adding new modals or closeable elements, ensure that `aria-label` attributes are included for screen reader accessibility.
