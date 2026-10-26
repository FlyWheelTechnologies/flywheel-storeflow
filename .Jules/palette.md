## 2024-05-18 - Missing ARIA label on password toggle in Login.jsx
**Learning:** Found an icon-only button without an ARIA label in the core Login flow, which would block screen reader users from understanding they can toggle password visibility.
**Action:** Next time I see an icon-only button, verify it has a descriptive `aria-label`.
