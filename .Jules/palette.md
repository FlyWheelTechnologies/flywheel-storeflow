## 2024-05-19 - Missing ARIA Labels on Icon-only Modals
**Learning:** The application extensively uses generic `<button className="close-btn">✕</button>` across multiple components (`ConfirmationModal`, `Layout`, `Dashboard`, `Sales`) without accessible names, creating a recurring pattern of inaccessible modal interactions for screen reader users.
**Action:** When working on generic or shared UI components in this app, specifically check for and add missing `aria-label` attributes to icon-only buttons.
