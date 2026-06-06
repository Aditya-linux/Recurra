import React, { useState, useEffect } from 'react';
import { CheckCircle2, ExternalLink, ArrowRight, X } from 'lucide-react';

interface RedirectInfo {
  url: string | null;
  label: string;
  platformName: string | null;
  platformLogoUrl: string | null;
  platformUrl: string | null;
}

interface SubscriptionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  amount: string;
  redirect: RedirectInfo | null;
  autoRedirectSeconds?: number;
  txHash?: string | null;
}

const SubscriptionSuccessModal: React.FC<SubscriptionSuccessModalProps> = ({
  isOpen,
  onClose,
  planName,
  amount,
  redirect,
  autoRedirectSeconds = 0, // 0 = no auto-redirect
  txHash,
}) => {
  const [countdown, setCountdown] = useState(autoRedirectSeconds);

  useEffect(() => {
    if (!isOpen || !redirect?.url || autoRedirectSeconds <= 0) return;
    setCountdown(autoRedirectSeconds);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.open(redirect.url!, '_blank', 'noopener,noreferrer');
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, redirect, autoRedirectSeconds, onClose]);

  if (!isOpen) return null;

  const handleRedirect = () => {
    if (redirect?.url) {
      window.open(redirect.url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  return (
    <div
      id="subscription-success-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.3s ease-out',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          backgroundColor: 'var(--surface, #fff)',
          borderRadius: '24px',
          padding: '48px 40px 40px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--outline-variant, #e5e5e5)',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--on-surface-variant, #666)',
            borderRadius: '8px',
          }}
        >
          <X size={20} />
        </button>

        {/* Animated checkmark ring */}
        <div
          style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            animation: 'pulseRing 2s ease-in-out infinite',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both',
            }}
          >
            <CheckCircle2 size={32} color="white" />
          </div>
        </div>

        <h2
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--on-surface, #1a1a1a)',
            marginBottom: '8px',
            letterSpacing: '-0.02em',
          }}
        >
          Subscription Active!
        </h2>
        <p
          style={{
            fontSize: '15px',
            color: 'var(--on-surface-variant, #666)',
            marginBottom: '28px',
            lineHeight: 1.5,
          }}
        >
          You have successfully subscribed to <strong>{planName}</strong> for{' '}
          <strong>{amount}</strong>.
        </p>

        {/* Subscription summary card */}
        <div
          style={{
            background: 'var(--surface-container-low, #f8f8f8)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '28px',
            border: '1px solid var(--outline-variant, #e5e5e5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {redirect?.platformLogoUrl ? (
                <img
                  src={redirect.platformLogoUrl}
                  alt={redirect.platformName || ''}
                  style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                />
              ) : (
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, var(--primary, #3B82F6), #2563eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  {(planName || '?').charAt(0)}
                </div>
              )}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--on-surface, #1a1a1a)' }}>
                  {planName}
                </div>
                {redirect?.platformName && (
                  <div style={{ fontSize: '12px', color: 'var(--on-surface-variant, #888)', marginTop: '2px' }}>
                    via {redirect.platformName}
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Active
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {redirect?.url ? (
            <>
              <button
                onClick={handleRedirect}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--primary, #3B82F6), #2563eb)',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                }}
              >
                <ExternalLink size={18} />
                {redirect.label || `Go to ${redirect.platformName || 'Platform'}`}
                <ArrowRight size={16} />
              </button>
              {countdown > 0 && (
                <p style={{ fontSize: '13px', color: 'var(--on-surface-variant, #888)' }}>
                  Redirecting in {countdown}s...
                </p>
              )}
              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  borderRadius: '14px',
                  border: '1px solid var(--outline-variant, #e0e0e0)',
                  background: 'transparent',
                  color: 'var(--on-surface-variant, #666)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Stay on Rekura
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '14px 24px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--primary, #3B82F6), #2563eb)',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              View in Dashboard
              <ArrowRight size={16} />
            </button>
          )}
          
          {txHash && (
            <a
              href={`https://stellar.expert/explorer/${import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? 'public' : 'testnet'}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--primary, #3B82F6)',
                textDecoration: 'none',
                marginTop: '12px',
                fontWeight: 500,
              }}
            >
              Verify on Stellar Explorer <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scaleIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default SubscriptionSuccessModal;
