import { createContext, useContext, useState, useCallback, useMemo } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "success", options = {}) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      message,
      type,
      action: options.action,
      actionLabel: options.actionLabel,
      duration: options.duration ?? 4000,
      ...options
    };

    setToasts(prev => [...prev, toast]);

    if (toast.duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, toast.duration);
    }

    return id;
  }, []);

  const hideToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((message, options) => showToast(message, "success", options), [showToast]);
  const error = useCallback((message, options) => showToast(message, "error", options), [showToast]);
  const warning = useCallback((message, options) => showToast(message, "warning", options), [showToast]);
  const info = useCallback((message, options) => showToast(message, "info", options), [showToast]);

  const value = useMemo(() => ({
    toasts,
    showToast,
    hideToast,
    success,
    error,
    warning,
    info
  }), [toasts, showToast, hideToast, success, error, warning, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onClose }) {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 3000,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
      maxWidth: 'calc(100vw - 48px)'
    }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  const bgColors = {
    success: '#064e3b',
    error: '#991b1b',
    warning: '#92400e',
    info: '#1e3a8a'
  };

  const icons = {
    success: '✅',
    error: '⚠️',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const bgColor = bgColors[toast.type] || bgColors.success;
  const icon = icons[toast.type] || icons.success;

  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: bgColor,
        color: '#fff',
        padding: '14px 20px',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        minWidth: '300px',
        maxWidth: '500px'
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{toast.message}</div>
        {toast.action && (
          <button
            onClick={() => { toast.action(); onClose(toast.id); }}
            style={{
              background: '#f15a24', border: 'none', color: '#fff',
              padding: '6px 12px', borderRadius: '8px', fontSize: '11px',
              fontWeight: 800, cursor: 'pointer', marginTop: 8,
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
          >
            <span>📱</span> {toast.actionLabel}
          </button>
        )}
      </div>
      <button
        aria-label="Close notification"
        onClick={() => onClose(toast.id)}
        style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
          width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12
        }}
      >✕</button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}