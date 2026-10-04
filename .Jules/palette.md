## 2024-05-23 - Authentication Form Accessibility
**Learning:** Found that custom-built form components, especially simple ones, often miss fundamental accessibility links (like `htmlFor`/`id` combinations on inputs and labels). Also, floating icon buttons used for UX (like "show password") need explicit `aria-label` and `title` tags to be understandable for screen readers and tooltips.
**Action:** Always verify `htmlFor`/`id` linking when auditing custom form elements, and check any icon-only actions for `aria-label` tags.
