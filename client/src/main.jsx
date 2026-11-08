import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { initPostHog } from "./services/posthogService";

import { registerSW } from 'virtual:pwa-register';

// Initialize diagnostics & telemetry (PostHog)
initPostHog();

// In local development, proactively unregister any cached service worker to prevent stale cache
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
} else {
  // Register PWA service worker with immediate check in production
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] New StoreFlow version detected, updating cache...');
    },
    onOfflineReady() {
      console.log('[PWA] StoreFlow offline cache ready.');
    },
  });
}

window.addEventListener('online', () => {
  console.log('App is back online!');
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);
