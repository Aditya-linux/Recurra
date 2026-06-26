import React from 'react';
import { useWallet } from '../context/WalletContext';

const WalletModal: React.FC = () => {
  const { isModalOpen, closeModal, connectWallet } = useWallet();

  if (!isModalOpen) return null;

  return (
    <div className="modal-overlay active" id="wallet-modal" onClick={closeModal}>
      <div className="modal-content flex flex-col gap-5" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="text-h4" style={{ fontWeight: 600 }}>Connect Wallet</h3>
          <button
            onClick={closeModal}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--on-surface-variant)',
              padding: '4px',
              borderRadius: '8px',
              display: 'flex',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>
        <p className="text-body-sm" style={{ color: 'var(--on-surface-variant)', marginTop: '-4px' }}>Select a Stellar wallet to connect to Rekura.</p>
        
        <div className="flex flex-col gap-3">
          <div className="wallet-option" onClick={() => connectWallet('freighter')}>
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <rect width="40" height="40" rx="12" fill="#000000"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M20 12L12 16.5V25.5L20 30L28 25.5V16.5L20 12ZM14.5 17.9L20 14.8L25.5 17.9V24.1L20 27.2L14.5 24.1V17.9Z" fill="white"/>
              <circle cx="20" cy="21" r="2.5" fill="white"/>
            </svg>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>Freighter</div>
              <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>Browser Extension</div>
            </div>
          </div>
          
          <div className="wallet-option" onClick={() => connectWallet('albedo')}>
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <rect width="40" height="40" rx="12" fill="#00AEEF"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M20 11C15.029 11 11 15.029 11 20C11 24.971 15.029 29 20 29C24.971 29 29 24.971 29 20C29 15.029 24.971 11 20 11ZM20 26C16.686 26 14 23.314 14 20C14 16.686 16.686 14 20 14C23.314 14 26 16.686 26 20C26 23.314 23.314 26 20 26Z" fill="white"/>
              <path d="M24 16L16 24" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="16" cy="16" r="1.5" fill="white"/>
            </svg>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>Albedo</div>
              <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>Web Wallet</div>
            </div>
          </div>

          <div className="wallet-option" onClick={() => connectWallet('xbull')}>
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <rect width="40" height="40" rx="12" fill="#F8B12A"/>
              <path d="M12 15.5L16.5 22L20 27.5L23.5 22L28 15.5L23.5 19L20 23L16.5 19L12 15.5Z" fill="white"/>
              <path d="M11 17L15 25.5L20 29.5L25 25.5L29 17L25 19.5L20 25L15 19.5L11 17Z" fill="white" fillOpacity="0.7"/>
            </svg>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>xBull</div>
              <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>Browser Extension</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
