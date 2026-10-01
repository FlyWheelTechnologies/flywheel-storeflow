## 2024-10-01 - Missing ARIA Labels on Icon-only ActionButtons
**Learning:** Found several icon-only ActionButtons across the app (Products edit/delete, Sales receipt/whatsapp, Deposits close modals, etc.) that do not have `aria-label`s. This makes them inaccessible to screen readers since they contain only an icon (`<svg>`, `📄`, etc.) without text content inside the button tag (aside from the visually hidden or SVG element).
**Action:** Always verify `aria-label`s are applied to `ActionButton`s whenever text content is absent or only an icon is used.
