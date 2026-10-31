## 2024-11-01 - Missing aria-labels on Modals
**Learning:** Icon-only close buttons in modals are missing aria-labels, posing an accessibility issue for screen readers. This pattern is repeated across ConfirmationModal.jsx, Layout.jsx, Dashboard.jsx, and Sales.jsx.
**Action:** Identify and update icon-only buttons with explicit `aria-label` attributes to improve screen reader compatibility.
