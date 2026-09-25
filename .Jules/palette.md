## 2026-09-25 - Added ARIA dialog roles to ConfirmationModal
**Learning:** The ConfirmationModal lacked WAI-ARIA `role="dialog"` and `aria-modal="true"` attributes, as well as properly linked WAI-ARIA descriptions for screen readers.
**Action:** Add WAI-ARIA dialog attributes and `aria-label` to icon-only close buttons in all future modals to improve accessibility for screen readers.
