import React, { useState, useEffect } from 'react';
import { CheckCircle2, ExternalLink, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';

interface RedirectInfo {
  url: string | null;
  label: string;
  platformName: string | null;
  platformLogoUrl: string | null;
  platformUrl: string | null;
}

interface SubscriptionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  amount: string;
  redirect: RedirectInfo | null;
  autoRedirectSeconds?: number;
  txHash?: string | null;
}

const SubscriptionSuccessModal: React.FC<SubscriptionSuccessModalProps> = ({
  isOpen,
  onClose,
  planName,
  amount,
  redirect,
  autoRedirectSeconds = 0,
  txHash,
}) => {
  const [countdown, setCountdown] = useState(autoRedirectSeconds);

  useEffect(() => {
    if (!isOpen || !redirect?.url || autoRedirectSeconds <= 0) return;
    setCountdown(autoRedirectSeconds);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.open(redirect.url!, '_blank', 'noopener,noreferrer');
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, redirect, autoRedirectSeconds, onClose]);

  const handleRedirect = () => {
    if (redirect?.url) {
      window.open(redirect.url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white border-black/5 rounded-2xl shadow-xl">
        <div className="relative p-8">
          
          {/* Animated Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" />

          {/* Icon Animation Container */}
          <div className="flex justify-center mb-8 relative">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
              className="relative z-10 w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/25"
              >
                <CheckCircle2 size={36} className="text-white drop-shadow-md" strokeWidth={2.5} />
              </motion.div>
            </motion.div>
          </div>

          <DialogHeader className="text-center space-y-3 mb-8">
            <DialogTitle className="text-2xl font-bold tracking-tight text-black">
              Subscription Active!
            </DialogTitle>
            <DialogDescription className="text-[15px] text-black/60 leading-relaxed">
              You have successfully subscribed to <strong className="text-black font-semibold">{planName}</strong> for{' '}
              <strong className="text-black font-semibold">{amount}</strong>.
            </DialogDescription>
          </DialogHeader>

          {/* Subscription Summary Card */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-black/5 border border-black/10 rounded-xl p-4 mb-8 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              {redirect?.platformLogoUrl ? (
                <img
                  src={redirect.platformLogoUrl}
                  alt={redirect.platformName || ''}
                  className="w-12 h-12 rounded-xl object-cover ring-1 ring-black/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg ring-1 ring-black/10">
                  {(planName || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <div className="font-semibold text-[15px] text-black tracking-tight">
                  {planName}
                </div>
                {redirect?.platformName && (
                  <div className="text-[13px] text-black/50 mt-0.5 font-medium">
                    via {redirect.platformName}
                  </div>
                )}
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[13px] font-semibold border border-emerald-500/20 shadow-sm">
              Active
            </div>
          </motion.div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {redirect?.url ? (
              <>
                <Button
                  onClick={handleRedirect}
                  className="w-full py-5 text-[15px] rounded-xl bg-black text-white font-semibold shadow-sm hover:bg-gray-800 transition-all duration-150"
                >
                  <ExternalLink className="w-4 h-4 mr-2 opacity-80" strokeWidth={2.5} />
                  {redirect.label || `Go to ${redirect.platformName || 'Platform'}`}
                  <ArrowRight className="w-4 h-4 ml-2 opacity-80" strokeWidth={2.5} />
                </Button>
                {countdown > 0 && (
                  <p className="text-center text-[13px] text-black/50 font-medium">
                    Redirecting in {countdown}s...
                  </p>
                )}
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="w-full py-5 text-[15px] rounded-xl border-black/10 bg-transparent hover:bg-black/5 text-black/50 hover:text-black font-medium transition-all"
                >
                  Stay on Rekura
                </Button>
              </>
            ) : (
              <Button
                onClick={onClose}
                className="w-full py-5 text-[15px] rounded-xl bg-black text-white font-semibold shadow-sm hover:bg-gray-800 transition-all duration-150"
              >
                View in Dashboard
                <ArrowRight className="w-4 h-4 ml-2 opacity-80" strokeWidth={2.5} />
              </Button>
            )}
            
            {txHash && (
              <div className="text-center mt-3">
                <a
                  href={`https://stellar.expert/explorer/${import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? 'public' : 'testnet'}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 text-[13px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Verify on Stellar Explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionSuccessModal;
