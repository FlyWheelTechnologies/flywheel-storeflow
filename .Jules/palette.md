## 2024-05-14 - Missing ARIA labels on Icon-only Buttons
**Learning:** Found a widespread pattern across the application where icon-only buttons (like "✕" used for closing modals/toasts) lack `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Always ensure that icon-only interactive elements contain a descriptive `aria-label` attribute (e.g., `aria-label="Close modal"`) when building or modifying components in this design system.
