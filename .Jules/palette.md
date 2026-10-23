## 2023-10-23 - Accessibility of icon-only buttons
**Learning:** Icon-only buttons (such as text "✕") are highly inaccessible to screen readers and confusing to users without a tooltip or hover label, yet they appear frequently across the application (e.g. modals, form item rows).
**Action:** Add `aria-label` and `title` to such buttons to ensure proper accessibility and usability.
