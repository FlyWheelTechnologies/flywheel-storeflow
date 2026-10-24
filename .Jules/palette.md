## 2023-10-24 - Add ARIA Labels to Icon-Only Buttons
**Learning:** Found that multiple icon-only action buttons (like close modals `✕` and remove items `✕`) lack `aria-label` attributes. This is a common accessibility issue for screen readers which rely on labels to announce the button's action.
**Action:** Always verify that buttons containing only icons or visual indicators (like "✕") have a descriptive `aria-label` attribute (e.g., `aria-label="Close"`).
