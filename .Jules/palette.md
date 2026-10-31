## 2024-03-24 - Accessibility on Icon-Only Buttons
**Learning:** Found a recurring pattern in the codebase where icon-only buttons (like modal close buttons) are missing `aria-label` attributes. This breaks accessibility for screen reader users, who will just hear "button" without context.
**Action:** Add `aria-label` attributes to icon-only close buttons across `ConfirmationModal.jsx`, `Layout.jsx`, `Dashboard.jsx`, and `Sales.jsx`.
