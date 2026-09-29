## 2024-05-24 - Accessibility: Close buttons lack ARIA labels
**Learning:** Close buttons represented by '✕' or an icon lack semantic meaning for screen readers without an `aria-label`.
**Action:** Add `aria-label="Close"` or similar to all `close-btn` buttons across modals and toasts to ensure keyboard and screen reader accessibility.
