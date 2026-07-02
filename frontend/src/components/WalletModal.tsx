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
            <img src="/logos/freighter.webp" alt="Freighter Logo" width="36" height="36" style={{ flexShrink: 0, borderRadius: '8px', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>Freighter</div>
              <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>Browser Extension</div>
            </div>
          </div>
          
          <div className="wallet-option" onClick={() => connectWallet('albedo')}>
            <img src="/logos/albedo.png" alt="Albedo Logo" width="36" height="36" style={{ flexShrink: 0, borderRadius: '8px', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>Albedo</div>
              <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>Web Wallet</div>
            </div>
          </div>

          <div className="wallet-option" onClick={() => connectWallet('xbull')}>
            <img src="/logos/xbull.webp" alt="xBull Logo" width="36" height="36" style={{ flexShrink: 0, borderRadius: '8px', objectFit: 'cover' }} />
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
