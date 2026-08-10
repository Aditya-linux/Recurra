import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '../utils/api';
import { useWallet } from '../context/WalletContext';

interface Payment {
  id: string;
  transaction_hash: string;
  amount: string;
  token_address: string;
  payment_number: number;
  status: string;
  executed_at: string;
  plan_name: string;
  merchant_name: string;
}

const PaymentTimeline: React.FC = () => {
  const { walletAddress } = useWallet();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await api('/payments/history?limit=50');
      if (!res.ok) throw new Error(res.error || 'Failed to fetch history');
      setPayments(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (walletAddress) {
      fetchHistory();
    }
  }, [walletAddress]);

  const downloadReceipt = async (paymentId: string) => {
    try {
      // In a real app, this would hit the backend to get PDF or JSON, here we get JSON and could format it or trigger a PDF download.
      const res = await api(`/payments/${paymentId}/receipt`);
      if (!res.ok) throw new Error(res.error || 'Failed to fetch receipt');
      const receiptData = res.data.data;
      
      // Create a text blob for download for demonstration
      const textContent = `
RECEIPT: ${receiptData.receiptNumber}
DATE: ${receiptData.date}

FROM: ${receiptData.merchantName} (${receiptData.merchantEmail})
TO: ${receiptData.userEmail}

PLAN: ${receiptData.planName}
AMOUNT: ${receiptData.amount}

TRANSACTION HASH: ${receiptData.transactionHash}
PAYMENT NUMBER: ${receiptData.paymentNumber}

VERIFY: ${receiptData.explorerUrl}
`;
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${receiptData.receiptNumber}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download receipt');
    }
  };

  if (!walletAddress) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        Please connect your wallet to view payment history.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="pt-nav min-h-screen bg-gray-950 px-4 pb-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Payment Timeline</h1>
          <p className="mt-1 text-gray-400">View your transaction history and download receipts</p>
        </div>

        {payments.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 border-dashed bg-gray-900/30 p-12 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-gray-500" />
            <h3 className="text-lg font-medium text-white">No payments yet</h3>
            <p className="mt-1 text-gray-400">Your payment history will appear here once you subscribe to a plan.</p>
          </div>
        ) : (
          <div className="relative border-l border-gray-800 ml-4 md:ml-6 space-y-8 pb-8">
            {payments.map((payment, index) => {
              const isSuccess = payment.status === 'completed';
              const isFailed = payment.status === 'failed';
              
              return (
                <motion.div 
                  key={payment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative pl-8 md:pl-10"
                >
                  {/* Timeline Dot */}
                  <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 ring-4 ring-gray-950">
                    {isSuccess ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    ) : isFailed ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-blue-500" />
                    )}
                  </span>

                  <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 transition hover:bg-gray-800/50">
                    <div className="flex flex-col justify-between sm:flex-row sm:items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-medium text-white">{payment.merchant_name}</h3>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            isSuccess ? 'bg-emerald-500/10 text-emerald-400' : isFailed ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-400">
                          Payment #{payment.payment_number} • {payment.plan_name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(payment.executed_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-col items-start sm:mt-0 sm:items-end">
                        <span className="text-xl font-bold text-white">
                          ${(Number(payment.amount) / 10000000).toFixed(2)}
                        </span>
                        
                        <div className="mt-3 flex space-x-2">
                          {payment.transaction_hash && (
                            <a 
                              href={`https://stellar.expert/explorer/testnet/tx/${payment.transaction_hash}`}
                              target="_blank" rel="noreferrer"
                              className="inline-flex items-center rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                            >
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Explorer
                            </a>
                          )}
                          
                          {isSuccess && (
                            <button 
                              onClick={() => downloadReceipt(payment.id)}
                              className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                            >
                              <Download className="mr-1.5 h-3.5 w-3.5" /> Receipt
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentTimeline;
