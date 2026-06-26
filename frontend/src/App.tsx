import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { WalletProvider, useWallet } from './context/WalletContext';
import Navbar from './components/Navbar';
import WalletModal from './components/WalletModal';
import ErrorBoundary from './components/ErrorBoundary';
import FeedbackModal from './components/FeedbackModal';
import AnalyticsWrapper from './components/AnalyticsWrapper';
import { AnimatePresence } from 'framer-motion';

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import MerchantIntegration from './pages/MerchantIntegration';
import UserIntegration from './pages/UserIntegration';
import SubscriptionCenter from './pages/SubscriptionCenter';
import DemoMerchant from './pages/DemoMerchant';
import CheckoutWidget from './pages/CheckoutWidget';
import { Toaster } from 'react-hot-toast';

const StrictUserGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole } = useWallet();
  const intent = localStorage.getItem('recurra_intent');
  
  if (userRole === 'merchant' || intent === 'merchant') {
    return <Navigate to="/merchant" replace />;
  }
  return <>{children}</>;
};

const StrictMerchantGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole } = useWallet();
  const intent = localStorage.getItem('recurra_intent');
  
  if (userRole === 'merchant') {
    return <>{children}</>;
  }
  if (intent === 'user') {
    return <Navigate to="/subscriptions" replace />;
  }
  return <>{children}</>;
};

const RequireWallet: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { walletAddress } = useWallet();
  if (!walletAddress) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<RequireWallet><StrictUserGuard><ErrorBoundary><Dashboard /></ErrorBoundary></StrictUserGuard></RequireWallet>} />
        <Route path="/merchant" element={<RequireWallet><StrictMerchantGuard><ErrorBoundary><MerchantIntegration /></ErrorBoundary></StrictMerchantGuard></RequireWallet>} />
        <Route path="/user" element={<RequireWallet><StrictUserGuard><ErrorBoundary><UserIntegration /></ErrorBoundary></StrictUserGuard></RequireWallet>} />
        <Route path="/subscriptions" element={<RequireWallet><StrictUserGuard><ErrorBoundary><SubscriptionCenter /></ErrorBoundary></StrictUserGuard></RequireWallet>} />
        <Route path="/demo-merchant" element={<ErrorBoundary><DemoMerchant /></ErrorBoundary>} />
        <Route path="/checkout" element={<ErrorBoundary><CheckoutWidget /></ErrorBoundary>} />
      </Routes>
    </AnimatePresence>
  );
};

const GlobalFeedback: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const hasShown = sessionStorage.getItem('feedback_shown');
    if (!hasShown) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        sessionStorage.setItem('feedback_shown', 'true');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, []);

  return <FeedbackModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
};

const App: React.FC = () => {
  return (
    <WalletProvider>
      <Toaster 
        position="top-right" 
        toastOptions={{ 
          duration: 3000,
          style: {
            background: 'var(--surface-container-high)',
            color: 'var(--on-surface)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 500,
            padding: '12px 16px',
          },
          success: {
            iconTheme: {
              primary: 'var(--emerald-500)',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--error)',
              secondary: '#fff',
            },
          },
        }} 
      />
      <GlobalFeedback />
      <Router>
        <Navbar />
        <WalletModal />
        <ErrorBoundary>
          <AnalyticsWrapper>
            <AnimatedRoutes />
          </AnalyticsWrapper>
        </ErrorBoundary>
      </Router>
    </WalletProvider>
  );
};

export default App;
