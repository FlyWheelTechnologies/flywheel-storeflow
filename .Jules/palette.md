## 2024-10-07 - Accessibility for Icon-only Close Buttons
**Learning:** Found a recurring pattern in the codebase where icon-only `✕` buttons (like those in modals, alerts, and overlay closures) were missing `aria-label` attributes. This makes them inaccessible to screen reader users who only hear "button" without context.
**Action:** Always ensure any button consisting solely of an icon or generic character (like `✕` or `X`) has a descriptive `aria-label` (e.g., "Close modal", "Close notification") to ensure screen readers can announce its purpose accurately.
