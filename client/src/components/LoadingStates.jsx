import React from "react";

/**
 * Skeleton loader for table rows
 */
export const TableSkeleton = ({ rows = 6, columns = 5 }) => (
  <div>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 16,
        padding: '14px 0',
        borderBottom: '1px solid #f3f4f6',
        alignItems: 'center'
      }}>
        {Array.from({ length: columns }, (_, j) => (
          <div key={j} className="skeleton" style={{
            height: j === 0 ? 20 : 16,
            width: j === 0 ? '80%' : '60%',
            borderRadius: 4
          }} />
        ))}
      </div>
    ))}
  </div>
);

/**
 * Skeleton loader for cards/stat cards
 */
export const CardSkeleton = ({ count = 4 }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16
  }}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} style={{
        background: 'white',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        border: '1px solid #e5e7eb'
      }}>
        <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 28, width: '60%', borderRadius: 4 }} />
      </div>
    ))}
  </div>
);

/**
 * Full page loading skeleton
 */
export const PageSkeleton = ({ title = true, stats = true, table = true, tableRows = 6, tableColumns = 5 }) => (
  <div style={{ padding: 24 }}>
    {title && (
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 300, height: 40, borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton" style={{ width: 150, height: 45, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 140, height: 45, borderRadius: 8 }} />
        </div>
      </div>
    )}

    {stats && (
      <CardSkeleton count={5} />
    )}

    {table && (
      <div style={{ marginTop: 24, background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
        <div className="skeleton" style={{ height: 24, width: '30%', marginBottom: 20, borderRadius: 4 }} />
        <TableSkeleton rows={tableRows} columns={tableColumns} />
      </div>
    )}
  </div>
);

/**
 * Inline loading spinner for buttons and small areas
 */
export const InlineSpinner = ({ size = 16, color = '#f97316' }) => (
  <span style={{
    display: 'inline-block',
    width: size,
    height: size,
    border: `2px solid ${color}40`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  }} />
);

/**
 * Loading overlay for async operations
 */
export const LoadingOverlay = ({ isLoading, children, message = "Loading..." }) => {
  if (!isLoading) return children;

  return (
    <div style={{ position: 'relative', minHeight: 200 }}>
      <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
        {children}
      </div>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.9)',
        borderRadius: 'inherit',
        zIndex: 10
      }}>
        <InlineSpinner size={32} />
        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 14, fontWeight: 500 }}>{message}</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

/**
 * Empty state component for when there's no data
 */
export const EmptyState = ({ icon = "📭", title = "No data found", description = "", action }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    textAlign: 'center',
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e5e7eb'
  }}>
    <div style={{
      fontSize: 48,
      marginBottom: 16,
      opacity: 0.5
    }}>
      {icon}
    </div>
    <h3 style={{ color: '#1f2937', marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
      {title}
    </h3>
    {description && (
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14, maxWidth: 300 }}>
        {description}
      </p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        style={{
          background: '#f97316',
          color: '#fff',
          border: 'none',
          padding: '12px 24px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.target.style.background = '#ea580c'}
        onMouseLeave={e => e.target.style.background = '#f97316'}
      >
        {action.label}
      </button>
    )}
  </div>
);

/**
 * Error state component for failed loads
 */
export const ErrorState = ({ title = "Failed to load", message = "Something went wrong", onRetry }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    textAlign: 'center',
    background: '#fef2f2',
    borderRadius: 16,
    border: '1px solid #fecaca'
  }}>
    <div style={{
      width: 64,
      height: 64,
      marginBottom: 16,
      background: '#fecaca',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <span style={{ fontSize: 28 }}>⚠️</span>
    </div>
    <h3 style={{ color: '#991b1b', marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
      {title}
    </h3>
    <p style={{ color: '#b91c1c', marginBottom: 24, fontSize: 14, maxWidth: 300 }}>
      {message}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          padding: '12px 24px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.target.style.background = '#dc2626'}
        onMouseLeave={e => e.target.style.background = '#ef4444'}
      >
        🔄 Try Again
      </button>
    )}
  </div>
);