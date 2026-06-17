import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider, useWallet } from './context/WalletContext';
import Navbar from './components/Navbar';
import WalletModal from './components/WalletModal';
import ErrorBoundary from './components/ErrorBoundary';
import AnalyticsWrapper from './components/AnalyticsWrapper';

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import MerchantIntegration from './pages/MerchantIntegration';
import UserIntegration from './pages/UserIntegration';
import SubscriptionCenter from './pages/SubscriptionCenter';
import DemoMerchant from './pages/DemoMerchant';
import CheckoutWidget from './pages/CheckoutWidget';
import { Toaster } from 'react-hot-toast';

const RoleGuard: React.FC<{ children: React.ReactNode, restrictRole: string, redirectTo: string }> = ({ children, restrictRole, redirectTo }) => {
  const { userRole } = useWallet();
  if (userRole === restrictRole) {
    return <Navigate to={redirectTo} replace />;
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

const App: React.FC = () => {
  return (
    <WalletProvider>
      <Toaster position="top-right" toastOptions={{ duration: 2000 }} />
      <Router>
        <Navbar />
        <WalletModal />
        <ErrorBoundary>
          <AnalyticsWrapper>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<RequireWallet><RoleGuard restrictRole="merchant" redirectTo="/merchant"><ErrorBoundary><Dashboard /></ErrorBoundary></RoleGuard></RequireWallet>} />
              <Route path="/merchant" element={<RequireWallet><ErrorBoundary><MerchantIntegration /></ErrorBoundary></RequireWallet>} />
              <Route path="/user" element={<RequireWallet><RoleGuard restrictRole="merchant" redirectTo="/merchant"><ErrorBoundary><UserIntegration /></ErrorBoundary></RoleGuard></RequireWallet>} />
              <Route path="/subscriptions" element={<RequireWallet><RoleGuard restrictRole="merchant" redirectTo="/merchant"><ErrorBoundary><SubscriptionCenter /></ErrorBoundary></RoleGuard></RequireWallet>} />
              <Route path="/demo-merchant" element={<ErrorBoundary><DemoMerchant /></ErrorBoundary>} />
              <Route path="/checkout" element={<ErrorBoundary><CheckoutWidget /></ErrorBoundary>} />
            </Routes>
          </AnalyticsWrapper>
        </ErrorBoundary>
      </Router>
    </WalletProvider>
  );
};

export default App;
