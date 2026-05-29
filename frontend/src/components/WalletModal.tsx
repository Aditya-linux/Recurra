import React from 'react';
import { useWallet } from '../context/WalletContext';

const WalletModal: React.FC = () => {
  const { isModalOpen, closeModal, connectWallet } = useWallet();

  if (!isModalOpen) return null;

  return (
    <div className="modal-overlay active" id="wallet-modal" onClick={closeModal}>
      <div className="modal-content flex flex-col gap-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="text-h3" style={{ fontSize: '24px' }}>Connect Wallet</h3>
          <span className="material-symbols-outlined" onClick={closeModal} style={{ cursor: 'pointer', color: 'var(--on-surface-variant)' }}>close</span>
        </div>
        <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>Select a Stellar wallet to connect to Recurra.</p>
        
        <div className="flex flex-col gap-4">
          <div className="wallet-option" onClick={() => connectWallet('freighter')}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>F</div>
            <div>
              <div className="text-body-lg" style={{ fontWeight: 600 }}>Freighter</div>
              <div className="text-label-caps" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>Browser Extension</div>
            </div>
          </div>
          
          <div className="wallet-option" onClick={() => connectWallet('albedo')}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00AEEF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>A</div>
            <div>
              <div className="text-body-lg" style={{ fontWeight: 600 }}>Albedo</div>
              <div className="text-label-caps" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>Web Wallet</div>
            </div>
          </div>

          <div className="wallet-option" onClick={() => connectWallet('xbull')}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F8B12A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>X</div>
            <div>
              <div className="text-body-lg" style={{ fontWeight: 600 }}>xBull</div>
              <div className="text-label-caps" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>Browser Extension</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
