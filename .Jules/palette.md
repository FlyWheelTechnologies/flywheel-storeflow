## 2023-10-30 - Missing aria-labels on generic close buttons
**Learning:** This application heavily uses icon-only close buttons (like "✕" and "<X size={20} />") inside modals and overlays. These elements frequently lack `aria-label` attributes, making them inaccessible to screen readers which will just read "times" or "button". This pattern is prevalent across key layout and dashboard components.
**Action:** Always verify `aria-label` is present on `.close-btn` and similar icon-only interactive elements across the application, especially inside generic modal or card header structures.
