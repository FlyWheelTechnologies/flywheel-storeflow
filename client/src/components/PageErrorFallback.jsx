import React from "react";
import { useNavigate } from "react-router-dom";

/**
 * Page-level error fallback component
 * Provides a consistent error UI for individual pages with navigation options
 */
const PageErrorFallback = ({ error, resetErrorBoundary, pageName = "this page" }) => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  const handleRetry = () => {
    resetErrorBoundary();
  };

  return (
    <div style={{
      minHeight: '400px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{
        width: 80,
        height: 80,
        marginBottom: 24,
        background: '#fef2f2',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ fontSize: 36 }}>⚠️</span>
      </div>
      <h2 style={{ color: '#1f2937', marginBottom: 8, fontSize: 22, fontWeight: 700 }}>
        Unable to Load {pageName}
      </h2>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14, maxWidth: 400, textAlign: 'center' }}>
        We encountered an issue loading this page. This could be a temporary connection issue or a bug.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={handleRetry}
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
          🔄 Try Again
        </button>
        <button
          onClick={handleGoBack}
          style={{
            background: '#fff',
            color: '#374151',
            border: '1.5px solid #d1d5db',
            padding: '12px 24px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.target.style.background = '#f9fafb'; e.target.style.borderColor = '#9ca3af'; }}
          onMouseLeave={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#d1d5db'; }}
        >
          ← Go Back
        </button>
        <button
          onClick={handleGoHome}
          style={{
            background: '#fff',
            color: '#374151',
            border: '1.5px solid #d1d5db',
            padding: '12px 24px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.target.style.background = '#f9fafb'; e.target.style.borderColor = '#9ca3af'; }}
          onMouseLeave={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#d1d5db'; }}
        >
          🏠 Go to Dashboard
        </button>
      </div>

      {(import.meta.env?.DEV || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')) && error && (
        <details style={{ marginTop: 32, width: '100%', maxWidth: 600 }}>
          <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: 12, fontWeight: 600 }}>
            Error Details (Development Mode)
          </summary>
          <pre style={{
            marginTop: 12,
            padding: 12,
            background: '#f9fafb',
            borderRadius: 8,
            fontSize: 11,
            color: '#ef4444',
            overflow: 'auto',
            maxHeight: 200,
            textAlign: 'left'
          }}>
            {error.toString()}
          </pre>
        </details>
      )}
    </div>
  );
};

export default PageErrorFallback;