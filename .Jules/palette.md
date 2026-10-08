## 2024-10-08 - Added accessible password toggle in login page
**Learning:** The password toggle input on the login page didn't have aria labels, making it inaccessible to screen readers, and hard to understand its purpose from a keyboard-only perspective without descriptive tooltips.
**Action:** Add `aria-label` and `title` to the password toggle button.
