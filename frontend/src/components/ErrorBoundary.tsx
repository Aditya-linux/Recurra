import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          {/* Error icon */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '28px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>error</span>
            </div>
          </div>

          <h2
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--on-surface, #1a1a1a)',
              marginBottom: '12px',
              letterSpacing: '-0.02em',
            }}
          >
            Something went wrong
          </h2>

          <p
            style={{
              fontSize: '15px',
              color: 'var(--on-surface-variant, #666)',
              marginBottom: '8px',
              maxWidth: '400px',
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred while rendering this page. This may be a temporary issue.
          </p>

          {this.state.error && (
            <details
              style={{
                marginTop: '12px',
                marginBottom: '24px',
                maxWidth: '500px',
                width: '100%',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--on-surface-variant, #888)',
                  userSelect: 'none',
                }}
              >
                Technical details
              </summary>
              <pre
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'var(--surface-container-low, #f5f5f5)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#ef4444',
                  textAlign: 'left',
                  overflow: 'auto',
                  maxHeight: '150px',
                  border: '1px solid var(--outline-variant, #e5e5e5)',
                }}
              >
                {this.state.error.message}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '12px 28px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--primary, #3B82F6), #2563eb)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '12px 28px',
                borderRadius: '12px',
                border: '1px solid var(--outline-variant, #e0e0e0)',
                background: 'transparent',
                color: 'var(--on-surface-variant, #666)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
