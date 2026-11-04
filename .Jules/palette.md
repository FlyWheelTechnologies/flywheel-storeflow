## 2024-11-04 - [Missing ARIA labels on close modals]
**Learning:** Found a recurring pattern where modal close buttons ('X') across ConfirmationModal, Layout, and Dashboard lack accessible names, making them invisible to screen readers.
**Action:** Ensure all new icon-only actionable elements use aria-label attributes.
