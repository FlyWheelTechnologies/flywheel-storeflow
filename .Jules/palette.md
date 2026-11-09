## 2024-05-15 - Missing ARIA Labels on Icon-only Close Buttons
**Learning:** Found a recurring pattern where modal close buttons (e.g., in `ConfirmationModal.jsx`, `Layout.jsx`, `Dashboard.jsx`) are implemented as `<button className="close-btn">✕</button>`. These buttons are icon-only (using the '✕' character) and lack any text that a screen reader can announce, meaning visually impaired users won't know these buttons close the modal.
**Action:** Always add an `aria-label="Close"` attribute to generic icon-only close buttons.
