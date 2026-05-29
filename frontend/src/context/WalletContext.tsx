import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isTokenValid, API_BASE } from '../utils/api';
import toast from 'react-hot-toast';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { TransactionBuilder, Account, Operation, TimeoutInfinite, Networks } from '@stellar/stellar-sdk';

interface WalletContextType {
  walletAddress: string | null;
  fullWalletAddress: string | null;
  userRole: string | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  connectWallet: (walletId: string) => Promise<void>;
  disconnect: () => void;
  setUserRole: (role: string | null) => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(localStorage.getItem('walletAddress'));
  const [fullWalletAddress, setFullWalletAddress] = useState<string | null>(localStorage.getItem('fullWalletAddress'));
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem('userRole'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(localStorage.getItem('activeWalletId') || 'freighter');

  // Initialize the wallet kit statically
  useEffect(() => {
    try {
      StellarWalletsKit.init({
        modules: [
          new FreighterModule(),
          new AlbedoModule(),
          new xBullModule()
        ],
        selectedWalletId: activeWalletId || 'freighter',
        network: 'TESTNET' as any
      });
    } catch (e) {
      console.error("Error initializing StellarWalletsKit:", e);
    }
  }, []);

  useEffect(() => {
    if (activeWalletId) {
      try {
        StellarWalletsKit.setWallet(activeWalletId);
        localStorage.setItem('activeWalletId', activeWalletId);
      } catch (e) {
        console.error("Failed to set wallet", e);
      }
    }
  }, [activeWalletId]);

  // Sync React state → localStorage
  useEffect(() => {
    if (walletAddress) localStorage.setItem('walletAddress', walletAddress);
    else localStorage.removeItem('walletAddress');
    
    if (fullWalletAddress) localStorage.setItem('fullWalletAddress', fullWalletAddress);
    else localStorage.removeItem('fullWalletAddress');

    if (userRole) localStorage.setItem('userRole', userRole);
    else localStorage.removeItem('userRole');
  }, [walletAddress, fullWalletAddress, userRole]);

  const checkTokenValidity = useCallback(() => {
    const token = localStorage.getItem('recurra_token');
    if (token && !isTokenValid()) {
      console.warn('[WalletContext] JWT expired — clearing stale session');
      localStorage.removeItem('recurra_token');
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    checkTokenValidity();
    const interval = setInterval(checkTokenValidity, 60_000);
    return () => clearInterval(interval);
  }, [checkTokenValidity]);

  const handleSuccessfulConnection = (publicKey: string) => {
    const formattedAddress = publicKey.substring(0, 5) + '...' + publicKey.substring(publicKey.length - 4).toUpperCase();
    setWalletAddress(formattedAddress);
    setFullWalletAddress(publicKey);
    setIsModalOpen(false);
  };

  const connectWallet = async (walletId: string) => {
    setActiveWalletId(walletId);
    
    try {
      StellarWalletsKit.setWallet(walletId);
    } catch (e) {
      console.error('Failed to set wallet:', e);
    }

    // Step 1: Get the wallet address (with retry)
    let publicKey: string;
    try {
      let fetchResult: { address: string } | null = null;
      
      // Try up to 3 times — Freighter's service worker sometimes wakes up slowly
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          fetchResult = await StellarWalletsKit.fetchAddress();
          break; // success
        } catch (err: any) {
          const msg = err?.message || String(err);
          if (msg.includes('not installed')) {
            toast.error(`Please install the ${walletId} wallet extension first.`);
            return;
          }
          if (attempt < 3) {
            console.warn(`[Wallet] fetchAddress attempt ${attempt} failed, retrying...`, msg);
            await new Promise(r => setTimeout(r, 500 * attempt)); // wait 500ms, 1000ms
          } else {
            throw err;
          }
        }
      }

      if (!fetchResult?.address) {
        toast.error('Could not retrieve wallet address. Please refresh your browser and try again.');
        return;
      }
      
      publicKey = fetchResult.address;
    } catch (e: any) {
      console.error('[Wallet] Failed to fetch address:', e);
      toast.error('Wallet connection failed. Please make sure your wallet extension is unlocked and refresh the page.');
      return;
    }

    // Step 2: Sign an auth transaction to prove ownership
    let signedTxXdr = '';
    try {
      const account = new Account(publicKey, '0');
      const tx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET
      })
      .addOperation(Operation.manageData({
        name: 'auth',
        value: Date.now().toString(),
        source: publicKey
      }))
      .setTimeout(TimeoutInfinite)
      .build();

      const result = await StellarWalletsKit.signTransaction(tx.toXDR(), { networkPassphrase: Networks.TESTNET });
      signedTxXdr = result.signedTxXdr;
    } catch (signErr: any) {
      const msg = signErr?.message || String(signErr);
      if (msg.includes('User declined') || msg.includes('cancel') || msg.includes('reject')) {
        toast.error('You must sign the transaction to connect.');
      } else {
        console.error('[Wallet] Sign failed:', signErr);
        toast.error('Signing failed. Please try again.');
      }
      return;
    }

    // Step 3: Authenticate with the backend
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const res = await fetch(`${API_BASE}/auth/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey,
          signedTxXdr,
          publicKey
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('recurra_token', data.accessToken);
        setUserRole(data.user.role);
        handleSuccessfulConnection(publicKey);
        toast.success('Wallet connected successfully!');
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('[Wallet] Backend auth failed:', res.status, errData);
        // Still connect the wallet in view-only mode so user isn't blocked
        handleSuccessfulConnection(publicKey);
        toast('Wallet connected (limited mode). Backend auth failed — some features may be unavailable.', { icon: '⚠️' });
      }
    } catch (fetchErr: any) {
      console.error('[Wallet] Backend auth network error:', fetchErr);
      // Still connect the wallet in view-only mode
      handleSuccessfulConnection(publicKey);
      toast('Wallet connected (limited mode). Backend is unreachable — please ensure it is running.', { icon: '⚠️' });
    }
  };

  const signTransaction = async (xdr: string): Promise<string> => {
    const networkPassphrase = import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, { networkPassphrase });
    return signedTxXdr;
  };

  const disconnect = () => {
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} card max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col gap-4 p-4 border border-[var(--outline-variant)]`}>
        <div className="flex flex-col">
          <p className="text-h3" style={{ fontSize: '18px' }}>Disconnect wallet?</p>
          <p className="text-body-md mt-1" style={{ color: 'var(--on-surface-variant)' }}>Are you sure you want to log out of Recurra?</p>
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button 
            className="btn font-medium" 
            style={{ padding: '8px 16px', border: '1px solid var(--outline-variant)', borderRadius: '8px', background: 'var(--surface)' }} 
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
          <button 
            className="btn font-medium" 
            style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--destructive, #ef4444)', color: 'white' }} 
            onClick={() => {
              setWalletAddress(null);
              setFullWalletAddress(null);
              setUserRole(null);
              localStorage.removeItem('recurra_token');
              localStorage.removeItem('activeWalletId');
              toast.dismiss(t.id);
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    ), { duration: Infinity, position: 'top-center' });
  };

  return (
    <WalletContext.Provider value={{
      walletAddress, fullWalletAddress, userRole, isModalOpen, 
      openModal: () => setIsModalOpen(true), 
      closeModal: () => setIsModalOpen(false),
      connectWallet, disconnect, setUserRole, signTransaction
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
};
