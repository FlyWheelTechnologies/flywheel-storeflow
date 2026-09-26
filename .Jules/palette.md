## 2025-02-14 - Add Accessibility and Tooltips to Icon-Only Buttons
**Learning:** Many interactive "remove", "clear", or "close" buttons in the app rely on the '✕' character without providing any screen reader support (ARIA labels) or hover tooltips for sighted users. This causes ambiguity and reduces accessibility.
**Action:** Added `aria-label` and `title` attributes to icon-only '✕' buttons across the app to ensure screen readers can announce the action and sighted users receive a helpful tooltip on hover.
