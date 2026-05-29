import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import Navbar from './components/Navbar';
import WalletModal from './components/WalletModal';

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
      <Toaster position="top-right" />
      <Router>
        <Navbar />
        <WalletModal />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/merchant" element={<MerchantIntegration />} />
          <Route path="/user" element={<UserIntegration />} />
          <Route path="/subscriptions" element={<SubscriptionCenter />} />
          <Route path="/demo-merchant" element={<DemoMerchant />} />
          <Route path="/checkout" element={<CheckoutWidget />} />
        </Routes>
      </Router>
    </WalletProvider>
  );
};

export default App;
