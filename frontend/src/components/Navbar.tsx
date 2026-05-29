import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../hooks/useTheme';

const Navbar: React.FC = () => {
  const { walletAddress, openModal, disconnect } = useWallet();
  const { isDark, toggleTheme } = useTheme();

  const getNavClass = ({ isActive }: { isActive: boolean }) => {
    return `text-nav-link ${isActive ? '' : 'inactive-link'}`;
  };

  return (
    <nav className="navbar">
      <div className="container flex items-center justify-between" style={{ width: '100%' }}>
        <Link to="/" className="logo text-h3" style={{ fontSize: '24px', textDecoration: 'none', color: 'inherit' }}>
          Recurra
        </Link>
        <div className="nav-links flex gap-6 items-center">
          <NavLink to="/dashboard" className={getNavClass} style={({ isActive }) => isActive ? { color: 'var(--on-surface-variant)', fontWeight: 600 } : {}}>Dashboard</NavLink>
          <NavLink to="/merchant" className={getNavClass} style={({ isActive }) => isActive ? { color: 'var(--on-surface-variant)', fontWeight: 600 } : {}}>Merchant</NavLink>
          <NavLink to="/user" className={getNavClass} style={({ isActive }) => isActive ? { color: 'var(--on-surface-variant)', fontWeight: 600 } : {}}>User</NavLink>
          <NavLink to="/subscriptions" className={getNavClass} style={({ isActive }) => isActive ? { color: 'var(--on-surface-variant)', fontWeight: 600 } : {}}>Subscriptions</NavLink>
        </div>
        <div className="nav-actions flex gap-4 items-center">
          <button onClick={toggleTheme} className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
          {walletAddress ? (
            <div className="chip flex items-center gap-2" onClick={disconnect} style={{ cursor: 'pointer' }} title="Click to disconnect">
              <div className="pulse-dot"></div>
              <span>{walletAddress}</span>
            </div>
          ) : (
            <button onClick={openModal} className="btn btn-secondary">Connect Wallet</button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
