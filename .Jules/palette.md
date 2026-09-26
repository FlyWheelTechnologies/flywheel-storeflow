## 2024-05-24 - Adding Accessible Dialog Semantics to Custom Modals
**Learning:** We need to ensure that custom modal elements provide necessary accessibility hooks (`role="dialog"`, `aria-modal="true"`, and `aria-label` for icon buttons). These explicitly inform screen readers of the context shift. It is crucial to have `aria-labelledby` and `aria-describedby` linking back to the title and body of the dialog.
**Action:** Always add ARIA roles, states, and properties appropriately to custom modal dialogs, and ensure icon-only buttons include descriptive `aria-label`s.
