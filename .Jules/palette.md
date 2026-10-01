## 2023-10-24 - [Add ARIA labels to icon-only buttons]
**Learning:** Found multiple close ("✕") buttons across modals and toasts missing proper ARIA labels, making them inaccessible to screen readers.
**Action:** Always verify that buttons containing only an icon or symbol have an explicit `aria-label` providing their action (e.g., "Close dialog").
