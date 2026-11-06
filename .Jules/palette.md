## 2025-05-18 - Missing ARIA Labels on Close Buttons
**Learning:** Found a common pattern of missing `aria-label` attributes on icon-only close buttons (✕) across multiple modal components in the app (ConfirmationModal, Layout, Dashboard, Sales). This makes these critical interactive elements inaccessible to screen readers.
**Action:** Added `aria-label="Close"` to all identified instances. Future modal implementations should ensure these labels are included by default for accessibility.
