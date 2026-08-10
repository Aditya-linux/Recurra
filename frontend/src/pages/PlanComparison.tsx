import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useWallet } from '../context/WalletContext';
import { motion } from 'framer-motion';
import { Check, X, ArrowRight, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Plan {
  id: string;
  name: string;
  description: string;
  amount: string;
  token_address: string;
  interval_seconds: number;
  tier: string;
  trial_days: number;
  features: string[];
}

const PlanComparison: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const { walletAddress } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api('/plans');
        if (!response.ok) throw new Error(response.error || 'Failed to fetch plans');
        const sortedPlans = response.data.data.sort((a: Plan, b: Plan) => Number(a.amount) - Number(b.amount));
        setPlans(sortedPlans);
      } catch (err: any) {
        setError(err.message || 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleSubscribe = (planId: string) => {
    if (!walletAddress) {
      navigate('/login');
      return;
    }
    // Could open checkout widget or navigate to a checkout page
    console.log('Subscribe to', planId);
    alert('Subscription flow will start for ' + planId);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="pt-nav min-h-screen bg-gray-950 px-4 pb-20 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            Pricing Plans
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-xl text-gray-400"
          >
            Choose the perfect plan for your needs. Simple, transparent pricing powered by Stellar.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-12">
          {plans.map((plan, index) => {
            const isPopular = plan.tier?.toLowerCase() === 'pro';
            
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative flex flex-col rounded-2xl border p-8 shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
                  isPopular 
                    ? 'border-blue-500 bg-blue-900/10' 
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform rounded-full bg-blue-500 px-4 py-1 text-sm font-semibold tracking-wider text-white shadow-lg shadow-blue-500/50">
                    MOST POPULAR
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                  <p className="mt-2 text-gray-400">{plan.description}</p>
                </div>

                <div className="mb-6 flex items-baseline text-white">
                  <span className="text-5xl font-extrabold tracking-tight">
                    ${(Number(plan.amount) / 10000000).toFixed(2)}
                  </span>
                  <span className="ml-2 text-xl font-medium text-gray-400">/mo</span>
                </div>

                {plan.trial_days > 0 && (
                  <div className="mb-6 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
                    <Star className="mr-2 inline h-4 w-4" />
                    {plan.trial_days}-day free trial included
                  </div>
                )}

                <ul className="mb-8 flex flex-1 flex-col space-y-4">
                  {plan.features?.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <div className="flex-shrink-0">
                        <Check className="h-6 w-6 text-blue-500" />
                      </div>
                      <p className="ml-3 text-base text-gray-300">{feature}</p>
                    </li>
                  ))}
                  {/* Mock missing features based on tier if needed */}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  className={`mt-auto flex w-full items-center justify-center rounded-xl px-6 py-4 text-center text-lg font-medium transition-all duration-200 ${
                    isPopular
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 hover:shadow-blue-500/50'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlanComparison;
