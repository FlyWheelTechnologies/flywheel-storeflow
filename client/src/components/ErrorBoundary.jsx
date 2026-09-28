import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, render it
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default fallback UI
      return (
        <div style={{
          padding: 40,
          textAlign: 'center',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            width: 80,
            height: 80,
            margin: '0 auto 24px',
            background: '#fef2f2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: 36 }}>⚠️</span>
          </div>
          <h2 style={{ color: '#1f2937', marginBottom: 8, fontSize: 20 }}>
            Something went wrong
          </h2>
          <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
            We encountered an unexpected error. Please try again or contact support if the problem persists.
          </p>
          <details style={{ textAlign: 'left', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
            <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: 12, fontWeight: 600 }}>
              Error Details (for debugging)
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
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && '\n\n' + this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button
            onClick={this.handleRetry}
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
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;