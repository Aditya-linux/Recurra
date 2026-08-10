import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, AlertTriangle, Activity, CreditCard, Lock, Unlock, Clock } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import toast from 'react-hot-toast';

const SmartWallet: React.FC = () => {
  const { walletAddress } = useWallet();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'limits' | 'security'>('overview');
  
  // Mock data for UI demonstration since contract view functions aren't wired up in this mockup
  const walletState = {
    isDeployed: true,
    isFrozen: false,
    dailyLimit: '100 USDC',
    monthlyLimit: '1000 USDC',
    dailySpent: '24 USDC',
    monthlySpent: '120 USDC',
    autoApproveThreshold: '10 USDC',
    sessionKeys: [
      { id: '1', key: 'G...A1B2', expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(), limit: '50 USDC' },
      { id: '2', key: 'G...X9Y0', expiresAt: new Date(Date.now() - 86400000).toISOString(), limit: '10 USDC' }
    ]
  };

  const handleDeploy = async () => {
    setLoading(true);
    setTimeout(() => {
      toast.success('Smart Wallet deployed successfully!');
      setLoading(false);
    }, 2000);
  };

  const toggleFreeze = () => {
    const action = walletState.isFrozen ? 'unfrozen' : 'frozen';
    toast.success(`Wallet successfully ${action}`);
  };

  if (!walletAddress) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center text-white">
          <Shield className="mx-auto mb-4 h-16 w-16 text-blue-500" />
          <h2 className="text-2xl font-bold">Connect your wallet</h2>
          <p className="mt-2 text-gray-400">Please connect your Stellar wallet to manage your Smart Wallet.</p>
        </div>
      </div>
    );
  }

  if (!walletState.isDeployed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/20">
            <Shield className="h-10 w-10 text-blue-500" />
          </div>
          <h2 className="mb-4 text-2xl font-bold text-white">Upgrade to Smart Wallet</h2>
          <p className="mb-8 text-gray-400">
            Deploy an Account Abstraction contract to enable session keys, spending limits, and seamless auto-payments without popups.
          </p>
          <button
            onClick={handleDeploy}
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
            ) : (
              'Deploy Smart Wallet'
            )}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-nav min-h-screen bg-gray-950 px-4 pb-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-white">Smart Wallet Dashboard</h1>
            <p className="mt-1 text-gray-400">Manage your Account Abstraction features and security settings</p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={toggleFreeze}
              className={`flex items-center rounded-lg px-4 py-2 text-sm font-medium transition ${
                walletState.isFrozen 
                  ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' 
                  : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
              }`}
            >
              {walletState.isFrozen ? (
                <><Unlock className="mr-2 h-4 w-4" /> Unfreeze Wallet</>
              ) : (
                <><Lock className="mr-2 h-4 w-4" /> Emergency Freeze</>
              )}
            </button>
          </div>
        </div>

        {walletState.isFrozen && (
          <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-500">Wallet is currently frozen</h3>
                <p className="mt-1 text-sm text-red-400">All outgoing transactions and session keys are temporarily suspended.</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 flex space-x-2 overflow-x-auto border-b border-gray-800 pb-px">
          {['overview', 'sessions', 'limits', 'security'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
                <div className="flex items-center text-gray-400">
                  <Activity className="mr-2 h-5 w-5 text-blue-500" />
                  Daily Spending Limit
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold text-white">{walletState.dailySpent}</div>
                    <div className="text-sm text-gray-500">of {walletState.dailyLimit}</div>
                  </div>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-800">
                    <div className="h-full w-1/4 bg-blue-500"></div>
                  </div>
                </div>
              </div>
              
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
                <div className="flex items-center text-gray-400">
                  <CreditCard className="mr-2 h-5 w-5 text-emerald-500" />
                  Monthly Limit
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold text-white">{walletState.monthlySpent}</div>
                    <div className="text-sm text-gray-500">of {walletState.monthlyLimit}</div>
                  </div>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-800">
                    <div className="h-full w-[12%] bg-emerald-500"></div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
                <div className="flex items-center text-gray-400">
                  <Key className="mr-2 h-5 w-5 text-purple-500" />
                  Active Session Keys
                </div>
                <div className="mt-4 text-2xl font-bold text-white">
                  {walletState.sessionKeys.filter(k => new Date(k.expiresAt) > new Date()).length}
                </div>
                <div className="mt-1 text-sm text-gray-500">Providing seamless UX for dApps</div>
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">Session Keys</h3>
                  <p className="text-sm text-gray-400">Manage delegated keys that can sign on your behalf</p>
                </div>
                <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
                  Create New Key
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="border-b border-gray-800 bg-gray-900/50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3 text-left">Key ID</th>
                      <th className="px-6 py-3 text-left">Spending Limit</th>
                      <th className="px-6 py-3 text-left">Expires At</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletState.sessionKeys.map((key) => {
                      const isExpired = new Date(key.expiresAt) < new Date();
                      return (
                        <tr key={key.id} className="border-b border-gray-800 hover:bg-gray-800/20">
                          <td className="px-6 py-4 font-mono text-white">{key.key}</td>
                          <td className="px-6 py-4">{key.limit}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <Clock className="mr-2 h-4 w-4 text-gray-500" />
                              {new Date(key.expiresAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              isExpired ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              {isExpired ? 'Expired' : 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-red-500 hover:text-red-400">Revoke</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'limits' && (
            <div className="max-w-2xl rounded-xl border border-gray-800 bg-gray-900/50 p-6">
              <h3 className="mb-6 text-lg font-medium text-white">Global Spending Limits</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-400">Auto-Approve Threshold</label>
                  <p className="mb-3 text-xs text-gray-500">Transactions below this amount require no signature</p>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      defaultValue="10"
                      className="block w-full rounded-l-md border-0 bg-gray-800 py-2.5 pl-4 text-white ring-1 ring-inset ring-gray-700 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                    />
                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-700 bg-gray-800 px-4 text-gray-400 sm:text-sm">
                      USDC
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-400">Daily Limit</label>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      defaultValue="100"
                      className="block w-full rounded-l-md border-0 bg-gray-800 py-2.5 pl-4 text-white ring-1 ring-inset ring-gray-700 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                    />
                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-700 bg-gray-800 px-4 text-gray-400 sm:text-sm">
                      USDC
                    </span>
                  </div>
                </div>

                <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500">
                  Update Limits
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl rounded-xl border border-gray-800 bg-gray-900/50 p-6">
              <h3 className="mb-6 text-lg font-medium text-white">Security Settings</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border border-gray-800 p-4">
                  <div>
                    <h4 className="font-medium text-white">Multi-signature Support</h4>
                    <p className="mt-1 text-sm text-gray-400">Require multiple devices to approve large transactions</p>
                  </div>
                  <button className="rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                    Configure
                  </button>
                </div>
                
                <div className="flex items-center justify-between rounded-lg border border-gray-800 p-4">
                  <div>
                    <h4 className="font-medium text-white">Social Recovery</h4>
                    <p className="mt-1 text-sm text-gray-400">Recover your wallet using trusted guardians</p>
                  </div>
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
                    Setup
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default SmartWallet;
