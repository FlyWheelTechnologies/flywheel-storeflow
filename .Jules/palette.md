## 2024-09-25 - [Accessibility: Missing aria-labels on icon-only buttons]
**Learning:** Many interactive icon-only buttons (like ✕, ✏️, 🗑️) across various components (Customers page, Modals, Sales tables) lack `aria-label` attributes, which makes them inaccessible to screen reader users.
**Action:** Add descriptive `aria-label`s to these buttons to ensure screen readers can announce their purpose clearly.
