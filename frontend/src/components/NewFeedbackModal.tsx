import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Send, Star } from 'lucide-react';
import { trackEvent } from '../utils/analytics';
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose} style={{ fontFamily: '"TT Norms Pro", sans-serif' }}>
      <div 
        className="bg-white border border-black/5 rounded-3xl w-full max-w-[400px] p-4 md:p-6 shadow-2xl relative text-black" 
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-black/40 hover:text-black hover:bg-black/5 p-1.5 rounded-xl transition-colors"
        >
          <X size={18} />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-black/5 rounded-xl flex text-black">
            <MessageSquare size={22} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-black">Send Feedback</h2>
        </div>

        {submitted ? (
          <div className="text-center py-10 px-5">
            <div className="w-14 h-14 rounded-full bg-[#10b981]/15 text-[#10b981] flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-black mb-2 tracking-tight">Feedback Sent</h3>
            <p className="text-sm font-medium text-black/60">
              Thanks for your response, we look forward to your feedback!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-black/80">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-black/80">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-black/80">Feedback Type</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium focus:outline-none focus:border-black/30 focus:bg-white transition-colors appearance-none cursor-pointer"
              >
                <option value="feature">Feature Request</option>
                <option value="bug">Bug Report</option>
                <option value="general">General Feedback</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-black/80">Rating</label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="bg-transparent border-none p-1 cursor-pointer transition-colors duration-200"
                    style={{ color: star <= (hoveredRating || rating) ? '#fbbf24' : 'rgba(0,0,0,0.1)' }}
                  >
                    <Star size={24} fill={star <= (hoveredRating || rating) ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-black/80">Message</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think..."
                className="bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors resize-none"
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || !message.trim() || rating === 0} 
              className={`w-full flex items-center justify-center gap-2 mt-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all duration-200 ${
                isSubmitting || !message.trim() || rating === 0
                  ? 'bg-black/5 text-black/40 cursor-not-allowed shadow-none border border-black/5'
                  : 'bg-black text-white hover:bg-gray-800 cursor-pointer shadow-sm hover:shadow-md'
              }`}
            >
              {isSubmitting ? 'Sending...' : 'Send Feedback'}
              {!isSubmitting && <Send size={15} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default NewFeedbackModal;
