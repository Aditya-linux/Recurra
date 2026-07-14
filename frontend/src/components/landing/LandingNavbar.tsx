import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import NewFeedbackModal from '../NewFeedbackModal';

const LandingNavbar: React.FC = () => {
  const { walletAddress, openModal, disconnect, userRole } = useWallet();
  const navigate = useNavigate();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setWalletMenuOpen(false);
      }
    };
    if (walletMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [walletMenuOpen]);

  /* 5-second wait then feedback modal flow */
  useEffect(() => {
    if (walletAddress) {
      const intent = localStorage.getItem('recurra_intent');
      if (intent) {
        setPendingIntent(intent);
        localStorage.removeItem('recurra_intent'); // Prevent loops
        
        const timer = setTimeout(() => {
          setShowFeedbackModal(true);
        }, 5000);
        
        return () => clearTimeout(timer);
      } else if (!pendingIntent) {
        // Normal direct navigation if no new intent (e.g. page refresh)
        if (userRole === 'merchant') navigate('/merchant');
        else if (userRole === 'user') navigate('/user');
      }
    }
  }, [walletAddress, userRole, navigate, pendingIntent]);

  const handleFeedbackClose = () => {
    setShowFeedbackModal(false);
    if (pendingIntent === 'merchant') {
      navigate('/merchant');
    } else if (pendingIntent === 'user') {
      navigate('/user');
    }
  };

  return (
    <nav className="absolute top-0 left-0 right-0 z-20 px-6 py-1">
      <div className="flex items-center justify-between max-w-[88rem] mx-auto">
        {/* Left — Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <img
            src="/halo-logo.png"
            alt="Rekura Logo"
            className="h-14 md:h-20 w-auto"
          />
        </a>

        {/* Right — Wallet */}
        {walletAddress ? (
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <div
              className="flex items-center gap-2 bg-white text-black border border-black/10 text-sm font-medium px-5 py-2.5 rounded-full cursor-pointer hover:bg-black/5 transition-colors duration-200 shadow-sm"
              onClick={() => setWalletMenuOpen(!walletMenuOpen)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#333' }}>account_balance_wallet</span>
              <span>{walletAddress.length > 10 ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : walletAddress}</span>
            </div>
            {walletMenuOpen && (
              <div
                className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 p-2 min-w-[200px]"
                style={{ zIndex: 100 }}
              >
                <button
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  onClick={() => {
                    disconnect();
                    setWalletMenuOpen(false);
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openModal}
            className="bg-black text-white text-base font-medium px-7 py-2.5 rounded-full hover:bg-gray-800 transition-colors duration-200"
          >
            Open Wallet
          </button>
        )}
      </div>

      <NewFeedbackModal 
        isOpen={showFeedbackModal} 
        onClose={handleFeedbackClose} 
      />
    </nav>
  );
};

export default LandingNavbar;
