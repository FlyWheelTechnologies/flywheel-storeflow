## 2024-05-18 - Added Accessibility attributes to icon-only buttons
**Learning:** Icon-only buttons (like the show/hide password toggle) without text labels are completely inaccessible to screen reader users and can be confusing to standard users without hover text.
**Action:** Always add dynamic `aria-label` and `title` attributes to icon-only toggle buttons so they describe the resulting state of the action.
