import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Send } from 'lucide-react';
import { trackEvent } from '../utils/analytics';
import { Button } from "@/components/ui/button";
import { useWallet } from '../context/WalletContext';
import { api, getValidToken } from '../utils/api';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { walletAddress, userRole } = useWallet();
  const [name, setName] = useState('');
  const [feedbackType, setFeedbackType] = useState('feature');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [userSpend, setUserSpend] = useState('0');

  // Fetch spend when modal opens
  React.useEffect(() => {
    if (isOpen && walletAddress && getValidToken()) {
      const fetchSubs = async () => {
        const { ok, data } = await api('/user/subscriptions');
        if (ok && data && data.data) {
          const activeSubs = data.data.filter((s: any) => s.status === 'active');
          const totalMonthlySpend = activeSubs.reduce((acc: number, s: any) => {
            const amount = parseFloat(s.amount) || 0;
            return acc + (amount / 10000000);
          }, 0);
          setUserSpend(totalMonthlySpend.toFixed(2));
        }
      };
      fetchSubs();
    }
  }, [isOpen, walletAddress]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Track the feedback event
    trackEvent('submit_feedback', { type: feedbackType });

    try {
      await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          walletAddress: walletAddress || 'Not connected',
          userRole: userRole || 'Unknown',
          spend: userSpend,
          type: feedbackType,
          message
        })
      });

      setIsSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setMessage('');
        setName('');
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: '400px', padding: '24px',
        backgroundColor: 'var(--surface-container-low)',
        borderRadius: '16px', position: 'relative',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}
        >
          <X size={20} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ padding: '8px', background: 'rgba(52, 120, 246, 0.1)', color: 'var(--accent-blue)', borderRadius: '8px' }}>
            <MessageSquare size={24} />
          </div>
          <h2 className="text-h3" style={{ fontSize: '20px' }}>Send Feedback</h2>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ color: 'var(--emerald-500)', marginBottom: '12px' }}>✓ Thank you!</div>
            <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>Your feedback helps us improve.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px', color: 'var(--on-surface-variant)' }}>Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-container)', color: 'var(--on-surface)' }}
              />
            </div>

            <div>
              <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px', color: 'var(--on-surface-variant)' }}>Feedback Type</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-container)', color: 'var(--on-surface)' }}
              >
                <option value="feature">Feature Request</option>
                <option value="bug">Bug Report</option>
                <option value="general">General Feedback</option>
              </select>
            </div>
            
            <div>
              <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px', color: 'var(--on-surface-variant)' }}>Message</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think..."
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-container)', color: 'var(--on-surface)', resize: 'none' }}
              />
            </div>

            <Button type="submit" disabled={isSubmitting || !message.trim()} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {isSubmitting ? 'Sending...' : 'Send Feedback'}
              {!isSubmitting && <Send size={16} />}
            </Button>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default FeedbackModal;
