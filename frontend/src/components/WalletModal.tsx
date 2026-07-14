import React, { useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { motion, AnimatePresence } from 'framer-motion';

const WalletModal: React.FC = () => {
  const { isModalOpen, closeModal, connectWallet } = useWallet();

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (isModalOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen, closeModal]);

  return (
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="absolute inset-0 bg-black/20 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-black/5 p-5 md:p-8 flex flex-col gap-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-3xl font-semibold text-black tracking-tight" style={{ letterSpacing: '-0.04em' }}>Connect Wallet</h3>
              <button
                onClick={closeModal}
                className="p-2 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
              </button>
            </div>
            
            <p className="text-black/60 text-base leading-relaxed -mt-3">
              Select a Stellar wallet to connect to Rekura.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => connectWallet('freighter')}
                className="flex items-center gap-4 w-full p-4 rounded-2xl border border-black/5 bg-[#F5F5F5] hover:bg-black/5 transition-all duration-200 text-left group cursor-pointer"
              >
                <div className="bg-white rounded-xl shadow-sm p-1">
                  <img src="/logos/freighter.webp" alt="Freighter Logo" className="w-10 h-10 rounded-lg object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div>
                  <div className="text-base font-semibold text-black">Freighter</div>
                  <div className="text-sm text-black/50 mt-0.5">Browser Extension</div>
                </div>
              </button>
              
              <button 
                onClick={() => connectWallet('albedo')}
                className="flex items-center gap-4 w-full p-4 rounded-2xl border border-black/5 bg-[#F5F5F5] hover:bg-black/5 transition-all duration-200 text-left group cursor-pointer"
              >
                <div className="bg-white rounded-xl shadow-sm p-1">
                  <img src="/logos/albedo.png" alt="Albedo Logo" className="w-10 h-10 rounded-lg object-contain group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div>
                  <div className="text-base font-semibold text-black">Albedo</div>
                  <div className="text-sm text-black/50 mt-0.5">Web Wallet</div>
                </div>
              </button>

              <button 
                onClick={() => connectWallet('xbull')}
                className="flex items-center gap-4 w-full p-4 rounded-2xl border border-black/5 bg-[#F5F5F5] hover:bg-black/5 transition-all duration-200 text-left group cursor-pointer"
              >
                <div className="bg-white rounded-xl shadow-sm p-1">
                  <img src="/logos/xbull.webp" alt="xBull Logo" className="w-10 h-10 rounded-lg object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div>
                  <div className="text-base font-semibold text-black">xBull</div>
                  <div className="text-sm text-black/50 mt-0.5">Browser Extension</div>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WalletModal;
