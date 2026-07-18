export default function ConfirmationModal({ show, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", type = "danger", isLoading = false }) {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '380px' }}>
        <div className="modal-header">
          <h3 style={{ color: type === 'danger' ? '#ef4444' : '#111827' }}>{title}</h3>
          <button className="close-btn" onClick={onCancel} disabled={isLoading}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>{message}</p>
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
