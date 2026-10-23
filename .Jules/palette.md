## 2026-10-23 - Icon-only Password Toggle Accessibility
**Learning:** Icon-only password visibility toggles in authentication forms create a significant accessibility barrier for screen reader users if they lack an `aria-label`. Users cannot determine the purpose of the button or its current state without text context.
**Action:** Ensure all icon-only interactive elements, especially stateful toggles like password visibility, always include dynamic `aria-label` attributes reflecting their current function.
