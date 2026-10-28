## 2024-05-18 - Missing ARIA Labels on Icon-only Close Buttons
**Learning:** Found a recurring pattern of missing `aria-label` attributes on icon-only close buttons (`✕` or `<X />`) across multiple modal components (`ConfirmationModal.jsx`, `Layout.jsx`, `Dashboard.jsx`, and `Sales.jsx`).
**Action:** Always verify accessibility labels on icon-only buttons, especially generic close buttons in modals. Added `aria-label="Close modal"` to these elements to improve screen reader accessibility.
