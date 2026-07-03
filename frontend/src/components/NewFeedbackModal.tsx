import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Send, Star } from 'lucide-react';
import { trackEvent } from '../utils/analytics';
import { Button } from "@/components/ui/button";
import { useWallet } from '../context/WalletContext';
import { api, getValidToken, API_BASE } from '../utils/api';

interface NewFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NewFeedbackModal: React.FC<NewFeedbackModalProps> = ({ isOpen, onClose }) => {
  const { walletAddress, fullWalletAddress, userRole } = useWallet();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [feedbackType, setFeedbackType] = useState('feature');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
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
    if (rating === 0) {
      alert("Please select a star rating!");
      return;
    }

    setIsSubmitting(true);
    
    // Track the feedback event
    trackEvent('submit_new_feedback', { type: feedbackType, rating });

    try {
      await fetch(`${API_BASE}/new-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          walletAddress: fullWalletAddress || 'Not connected',
          userRole: userRole || 'Unknown',
          spend: userSpend,
          type: feedbackType,
          message,
          rating
        })
      });

      setIsSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setMessage('');
        setName('');
        setEmail('');
        setRating(0);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', padding: '4px', borderRadius: '8px', display: 'flex', transition: 'all 0.15s ease' }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
        >
          <X size={18} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ padding: '8px', background: 'rgba(96, 165, 250, 0.1)', color: 'var(--accent-blue)', borderRadius: '10px', display: 'flex' }}>
            <MessageSquare size={22} />
          </div>
          <h2 className="text-h4" style={{ fontWeight: 600 }}>Send Feedback</h2>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ 
              width: '56px', height: '56px', borderRadius: '50%', 
              background: 'var(--emerald-500-15)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              margin: '0 auto 20px', color: 'var(--emerald-500)' 
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 className="text-h4" style={{ marginBottom: '10px' }}>Feedback Sent</h3>
            <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
              Thanks for your response, we look forward to your feedback!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Feedback Type</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="form-select"
              >
                <option value="feature">Feature Request</option>
                <option value="bug">Bug Report</option>
                <option value="general">General Feedback</option>
              </select>
            </div>
            
            <div>
              <label className="form-label">Rating</label>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: star <= (hoveredRating || rating) ? 'var(--amber-400)' : 'var(--on-surface-variant)',
                      transition: 'color 0.2s ease'
                    }}
                  >
                    <Star size={24} fill={star <= (hoveredRating || rating) ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="form-label">Message</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think..."
                className="form-textarea"
              />
            </div>

            <Button type="submit" disabled={isSubmitting || !message.trim() || rating === 0} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '4px' }}>
              {isSubmitting ? 'Sending...' : 'Send Feedback'}
              {!isSubmitting && <Send size={15} />}
            </Button>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default NewFeedbackModal;
