## 2024-05-24 - Missing ARIA labels on common modal close buttons
**Learning:** Found a consistent pattern across the application where `.close-btn` components used for modals (ConfirmationModal, Layout Profile Modal, Dashboard Audit Modal) were implemented as icon-only buttons ("✕") without `aria-label`s. This makes them inaccessible to screen reader users who wouldn't know what the button does.
**Action:** When implementing or reviewing new modals or using the `.close-btn` class, always ensure an `aria-label="Close modal"` (or similar contextual label) is included.
