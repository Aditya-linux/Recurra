import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import Navbar from './components/Navbar';
import WalletModal from './components/WalletModal';
import ErrorBoundary from './components/ErrorBoundary';

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import MerchantIntegration from './pages/MerchantIntegration';
import UserIntegration from './pages/UserIntegration';
import SubscriptionCenter from './pages/SubscriptionCenter';
import DemoMerchant from './pages/DemoMerchant';
import CheckoutWidget from './pages/CheckoutWidget';
import { Toaster } from 'react-hot-toast';

const App: React.FC = () => {
  return (
    <WalletProvider>
      <Toaster position="top-right" toastOptions={{ duration: 2000 }} />
      <Router>
        <Navbar />
        <WalletModal />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/merchant" element={<ErrorBoundary><MerchantIntegration /></ErrorBoundary>} />
            <Route path="/user" element={<ErrorBoundary><UserIntegration /></ErrorBoundary>} />
            <Route path="/subscriptions" element={<ErrorBoundary><SubscriptionCenter /></ErrorBoundary>} />
            <Route path="/demo-merchant" element={<ErrorBoundary><DemoMerchant /></ErrorBoundary>} />
            <Route path="/checkout" element={<ErrorBoundary><CheckoutWidget /></ErrorBoundary>} />
          </Routes>
        </ErrorBoundary>
      </Router>
    </WalletProvider>
  );
};

export default App;
