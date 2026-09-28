## 2024-03-21 - [Accessibility]
**Learning:** Found multiple icon-only buttons missing `aria-label`s, which is critical for screen reader accessibility. Specifically, the "Show/Hide Password" button in `Login.jsx` is just an emoji with no label.
**Action:** Always ensure icon-only buttons have descriptive `aria-label`s.
