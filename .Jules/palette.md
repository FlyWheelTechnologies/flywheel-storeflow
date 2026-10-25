## 2024-05-24 - Modal Dialog Accessibility
**Learning:** Custom modal components often miss foundational dialog roles and labeling. When we have a custom component, we should always assign `role="dialog"` and `aria-modal="true"`. Also, an icon-only button like a close "X" often forgets its `aria-label`, making it invisible/unintuitive for screen readers.
**Action:** For all future modal or dialog components, enforce `role="dialog"`, map `aria-labelledby` to the title `id`, map `aria-describedby` to the description `id`, and ensure all icon buttons have an explicit `aria-label`.
