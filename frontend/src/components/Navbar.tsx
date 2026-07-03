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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const showNavLinks = walletAddress && location.pathname !== '/';
  const isMerchant = userRole === 'merchant';

  return (
    <>
      {/* ─── Desktop / Tablet Top Navbar ─── */}
      <div className="navbar-wrapper">
        <nav className="navbar">
          <Link to="/" className="logo-text" onClick={closeMenu} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginRight: '60px' }}>
            <img src={isDark ? '/logo-white.png' : '/logo-black.png'} alt="Rekura Logo" style={{ height: '28px', transform: 'scale(2.5)', transformOrigin: 'left center' }} />
          </Link>

          {/* Nav links – desktop only */}
          <div className="nav-links-desktop flex gap-6 items-center justify-center" style={{ flex: 1 }}>
            {showNavLinks && !isMerchant && (
              <>
                <NavLink to="/dashboard" className={getNavClass} onClick={closeMenu}>Dashboard</NavLink>
                <NavLink to="/user" className={getNavClass} onClick={closeMenu}>User Setup</NavLink>
                <NavLink to="/subscriptions" className={getNavClass} onClick={closeMenu}>Storefront</NavLink>
              </>
            )}
            {showNavLinks && isMerchant && (
              <NavLink to="/merchant" className={getNavClass} onClick={closeMenu}>
                Merchant Portal
              </NavLink>
            )}
          </div>

          {/* Actions – Right side */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="navbar-icon-btn"
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button
              onClick={() => setFeedbackOpen(true)}
              className="navbar-icon-btn desktop-only"
              title="Send Feedback"
            >
              <span className="material-symbols-outlined">feedback</span>
            </button>
            <button
              onClick={() => window.open('https://www.moonpay.com/buy?currencyCode=XLM', '_blank')}
              className="desktop-only hover-scale"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '40px', padding: 0, borderRadius: '20px', marginRight: '8px', background: 'transparent', border: '1px solid var(--outline-variant)', cursor: 'pointer', transition: 'all 0.2s', overflow: 'hidden' }}
              title="Buy Crypto with Fiat"
            >
              <img src={isDark ? "/logos/moonwhite.png" : "/logos/moonpay-custom.png"} alt="MoonPay" style={{ width: '130px', height: '130px', objectFit: 'contain', transform: isDark ? 'translateY(5px)' : 'translateY(2px)' }} />
            </button>
            {walletAddress ? (
              <div style={{ position: 'relative' }} ref={dropdownRef} className="desktop-only">
                <div
                  className="chip flex items-center gap-2"
                  onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                  style={{ cursor: 'pointer', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }}
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
              <button onClick={openModal} className="btn btn-primary desktop-only" style={{ padding: '8px 20px', fontSize: '14px', borderRadius: '9999px' }}>
                Connect Wallet
              </button>
            ) : null}
          </div>
        </nav>
      </div>

      {/* ─── Mobile Bottom Tab Bar (iOS-style) ─── */}
      {showNavLinks && (
        <div className="mobile-tab-bar">
          <div className="mobile-tab-bar-inner">
            {!isMerchant ? (
              <>
                <NavLink to="/dashboard" className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                  <span className="material-symbols-outlined">dashboard</span>
                  <span className="mobile-tab-label">Dashboard</span>
                </NavLink>
                <NavLink to="/subscriptions" className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                  <span className="material-symbols-outlined">storefront</span>
                  <span className="mobile-tab-label">Storefront</span>
                </NavLink>
                <NavLink to="/user" className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                  <span className="material-symbols-outlined">person</span>
                  <span className="mobile-tab-label">Profile</span>
                </NavLink>
              </>
            ) : (
              <NavLink to="/merchant" className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                <span className="material-symbols-outlined">store</span>
                <span className="mobile-tab-label">Merchant</span>
              </NavLink>
            )}
            <button className="mobile-tab" onClick={() => setMobileOpen(!mobileOpen)}>
              <span className="material-symbols-outlined">more_horiz</span>
              <span className="mobile-tab-label">More</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Mobile "More" Sheet (iOS Action Sheet style) ─── */}
      <div className={`mobile-sheet-overlay ${mobileOpen ? 'active' : ''}`} onClick={closeMenu} />
      <div className={`mobile-sheet ${mobileOpen ? 'active' : ''}`}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-content">
          {walletAddress && (
            <div className="mobile-sheet-wallet">
              <div className="pulse-dot"></div>
              <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{walletAddress}</span>
            </div>
          )}
          <button className="mobile-sheet-item" onClick={() => { setFeedbackOpen(true); closeMenu(); }}>
            <span className="material-symbols-outlined">feedback</span>
            Send Feedback
          </button>
          {walletAddress && (
            <>
              <button className="mobile-sheet-item" onClick={() => { disconnect(); openModal(); closeMenu(); }}>
                <span className="material-symbols-outlined">swap_horiz</span>
                Change Wallet
              </button>
              <div className="mobile-sheet-separator" />
              <button className="mobile-sheet-item mobile-sheet-item--danger" onClick={() => { disconnect(); closeMenu(); }}>
                <span className="material-symbols-outlined">logout</span>
                Disconnect
              </button>
            </>
          )}
          {!walletAddress && location.pathname !== '/' && (
            <button className="mobile-sheet-item" onClick={() => { openModal(); closeMenu(); }}>
              <span className="material-symbols-outlined">account_balance_wallet</span>
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
};

export default Navbar;
