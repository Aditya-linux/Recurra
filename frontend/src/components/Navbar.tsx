import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../hooks/useTheme';
import FeedbackModal from './FeedbackModal';

const Navbar: React.FC = () => {
  const { walletAddress, userRole, openModal, disconnect } = useWallet();
  const { isDark, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getNavClass = ({ isActive }: { isActive: boolean }) => {
    return `text-nav-link ${isActive ? 'active' : ''}`;
  };

  const closeMenu = () => setMobileOpen(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setWalletMenuOpen(false);
      }
    };
    if (walletMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [walletMenuOpen]);

  return (
    <nav className="navbar">
      <div className="container flex items-center justify-between" style={{ width: '100%', flexWrap: 'wrap' }}>
        <Link to="/" className="logo-text" onClick={closeMenu} style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src={`/rekura-logo.png?v=${Date.now()}`} 
            alt="Rekura." 
            style={{ 
              height: '56px', 
              width: 'auto',
              filter: isDark ? 'invert(1)' : 'none',
              transition: 'all 0.3s ease'
            }} 
          />
        </Link>

        {/* Nav links (Middle on desktop, bottom on mobile) */}
        <div className={`nav-links flex gap-6 items-center justify-center ${mobileOpen ? 'open' : ''}`} style={{ flex: 1, order: mobileOpen ? 3 : 2, minWidth: mobileOpen ? '100%' : 'auto' }}>
          {walletAddress && location.pathname !== '/' && userRole !== 'merchant' && (
            <>
              <NavLink to="/dashboard" className={getNavClass} onClick={closeMenu}>Dashboard</NavLink>
              <NavLink to="/user" className={getNavClass} onClick={closeMenu}>User Setup</NavLink>
              <NavLink to="/subscriptions" className={getNavClass} onClick={closeMenu}>Storefront</NavLink>
            </>
          )}
          {walletAddress && location.pathname !== '/' && userRole === 'merchant' && (
            <NavLink to="/merchant" className={getNavClass} onClick={closeMenu}>
              Merchant Portal
            </NavLink>
          )}
        </div>

        {/* Actions (Right on desktop) */}
        <div className="flex items-center gap-2" style={{ order: mobileOpen ? 2 : 3 }}>
          {/* Mobile hamburger */}
          <button
            className="nav-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            <span className="material-symbols-outlined">
              {mobileOpen ? 'close' : 'menu'}
            </span>
          </button>

          {/* Actions */}
          <div className="nav-actions flex gap-2 items-center">
            <button
              onClick={toggleTheme}
              className="btn-ghost"
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--on-surface-variant)',
                cursor: 'pointer',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button
              onClick={() => setFeedbackOpen(true)}
              className="btn-ghost"
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--on-surface-variant)',
                cursor: 'pointer',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Send Feedback"
            >
              <span className="material-symbols-outlined">feedback</span>
            </button>
            {walletAddress ? (
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <div
                  className="chip flex items-center gap-2"
                  onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="pulse-dot"></div>
                  <span>{walletAddress}</span>
                </div>
                {walletMenuOpen && (
                  <div className="dropdown-menu" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    zIndex: 100,
                  }}>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        disconnect();
                        openModal();
                        setWalletMenuOpen(false);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', opacity: 0.7 }}>swap_horiz</span>
                      Change Wallet
                    </button>
                    <div className="dropdown-separator" />
                    <button
                      className="dropdown-item dropdown-item--danger"
                      onClick={() => {
                        disconnect();
                        setWalletMenuOpen(false);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : location.pathname !== '/' ? (
              <button onClick={openModal} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }}>
                Connect Wallet
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </nav>
  );
};

export default Navbar;
