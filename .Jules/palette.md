## 2026-10-27 - Missing ARIA Labels on Custom Modal Close Buttons
**Learning:** This codebase frequently uses custom modal close buttons (like `<button className="close-btn">✕</button>`) that lack ARIA labels, making them inaccessible to screen readers as the symbol '✕' is not typically announced in a meaningful way.
**Action:** When working on modals or custom overlays in this design system, always verify that the '✕' close buttons have `aria-label="Close"` or a more specific descriptive label (e.g., `aria-label="Close profile settings"`).
