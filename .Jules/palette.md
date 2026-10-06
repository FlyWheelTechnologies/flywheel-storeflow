## 2024-05-18 - Missing ARIA labels on Icon-only buttons
**Learning:** Found a specific pattern in the app components where several icon-only buttons (like refresh, clear chat, expand chat, and modal close buttons) were missing `aria-label` attributes. Since these use Phosphor icons or text elements like `✕`, they provide no context to screen readers, creating a major accessibility barrier.
**Action:** Moving forward, ensure every icon-only button is equipped with an `aria-label` to maintain accessibility for screen reader users.
