export default function ConfirmationModal({ show, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", type = "danger", isLoading = false }) {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{ maxWidth: '380px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-desc"
      >
        <div className="modal-header">
          <h3 id="modal-title" style={{ color: type === 'danger' ? '#ef4444' : '#111827' }}>{title}</h3>
          <button className="close-btn" aria-label="Close dialog" onClick={onCancel} disabled={isLoading}>✕</button>
        </div>
        <div className="modal-body">
          <p id="modal-desc" style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>{message}</p>
        </div>
        <div className="modal-actions" style={{ padding: '0 20px 20px' }}>
          <button className="btn-secondary" onClick={onCancel} disabled={isLoading}>{cancelText}</button>
          <button 
            className="btn-primary" 
            style={{ background: type === 'danger' ? '#ef4444' : '#2563eb', opacity: isLoading ? 0.7 : 1 }}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
