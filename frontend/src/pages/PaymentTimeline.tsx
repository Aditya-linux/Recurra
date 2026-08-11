import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '../utils/api';
import { useWallet } from '../context/WalletContext';
import { PageWrapper, FadeIn } from '../components/ui/animations';

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
    if (walletAddress) { fetchHistory(); }
  }, [walletAddress]);

  const downloadReceipt = async (paymentId: string) => {
    try {
      const res = await api(`/payments/${paymentId}/receipt`);
      if (!res.ok) throw new Error(res.error || 'Failed to fetch receipt');
      const receiptData = res.data.data;
      
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
      <div className="flex h-screen items-center justify-center bg-[#F5F5F5] text-black">
        <div className="text-center">
          <Clock className="mx-auto mb-4 h-16 w-16 text-black/20" />
          <h2 className="text-2xl font-bold">Connect your wallet</h2>
          <p className="mt-2 text-black/50">Please connect your wallet to view payment history.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F5F5]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-black/30"></div>
      </div>
    );
  }

  return (
    <PageWrapper>
      <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
        <section className="container mx-auto px-6 mt-10 max-w-4xl">
          <FadeIn delay={0.1}>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>
              Payment Timeline
            </h2>
            <p className="text-lg text-black/60 mt-2 mb-10">
              View your transaction history and download receipts.
            </p>
          </FadeIn>

          {payments.length === 0 ? (
            <FadeIn>
              <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-12 text-center">
                <Clock className="mx-auto mb-4 h-14 w-14 text-black/15" />
                <h3 className="text-xl font-bold text-black">No payments yet</h3>
                <p className="mt-2 text-black/50">Your payment history will appear here once you subscribe to a plan.</p>
              </div>
            </FadeIn>
          ) : (
            <div className="relative border-l-2 border-black/10 ml-4 md:ml-6 space-y-6 pb-8">
              {payments.map((payment, index) => {
                const isSuccess = payment.status === 'completed';
                const isFailed = payment.status === 'failed';
                
                return (
                  <FadeIn key={payment.id} delay={index * 0.05}>
                    <div className="relative pl-8 md:pl-10">
                      {/* Timeline Dot */}
                      <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 border-black/10 shadow-sm">
                        {isSuccess ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        ) : isFailed ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-blue-500" />
                        )}
                      </span>

                      <div className="bg-white border border-black/5 shadow-sm rounded-2xl p-6 transition hover:shadow-md">
                        <div className="flex flex-col justify-between sm:flex-row sm:items-start">
                          <div>
                            <div className="flex items-center space-x-2 flex-wrap">
                              <h3 className="text-lg font-bold text-black">{payment.merchant_name}</h3>
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                                isSuccess ? 'bg-emerald-50 text-emerald-600' : isFailed ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {payment.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-black/50">
                              Payment #{payment.payment_number} • {payment.plan_name}
                            </p>
                            <p className="mt-1 text-xs text-black/30">
                              {new Date(payment.executed_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="mt-4 flex flex-col items-start sm:mt-0 sm:items-end">
                            <span className="text-xl font-bold text-black">
                              ${(Number(payment.amount) / 10000000).toFixed(2)}
                            </span>
                            
                            <div className="mt-3 flex space-x-2 flex-wrap gap-y-2">
                              {payment.transaction_hash && (
                                <a 
                                  href={`https://stellar.expert/explorer/testnet/tx/${payment.transaction_hash}`}
                                  target="_blank" rel="noreferrer"
                                  className="inline-flex items-center rounded-xl bg-[#F5F5F5] border border-black/5 px-3 py-1.5 text-xs font-semibold text-black/60 hover:bg-black/5 transition"
                                >
                                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Explorer
                                </a>
                              )}
                              
                              {isSuccess && (
                                <button 
                                  onClick={() => downloadReceipt(payment.id)}
                                  className="inline-flex items-center rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80 transition"
                                >
                                  <Download className="mr-1.5 h-3.5 w-3.5" /> Receipt
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </PageWrapper>
  );
};

export default PaymentTimeline;
