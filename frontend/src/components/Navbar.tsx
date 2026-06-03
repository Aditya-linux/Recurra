import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../hooks/useTheme';

const Navbar: React.FC = () => {
  const { walletAddress, userRole, openModal, disconnect } = useWallet();
  const { isDark, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const location = useLocation();

  const getNavClass = ({ isActive }: { isActive: boolean }) => {
    return `text-nav-link ${isActive ? 'active' : ''}`;
  };

  const closeMenu = () => setMobileOpen(false);

  return (
    <nav className="navbar">
      <div className="container flex items-center justify-between" style={{ width: '100%', flexWrap: 'wrap' }}>
        <Link to="/" className="logo-text" onClick={closeMenu} style={{ fontSize: '24px' }}>
          Rekura.
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
          <div className="nav-actions flex gap-4 items-center">
            <button
              onClick={toggleTheme}
              className="btn-ghost"
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--on-surface-variant)',
                cursor: 'pointer',
                borderRadius: 'var(--rounded)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
            {walletAddress ? (
              <div style={{ position: 'relative' }}>
                <div
                  className="chip flex items-center gap-2"
                  onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="pulse-dot"></div>
                  <span>{walletAddress}</span>
                </div>
                {walletMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    zIndex: 100,
                    minWidth: '150px'
                  }}>
                    <button
                      onClick={() => {
                        disconnect();
                        openModal();
                        setWalletMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--outline-variant)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'var(--on-surface)',
                        fontSize: '14px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-container-high)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      Change Wallet
                    </button>
                    <button
                      onClick={() => {
                        disconnect();
                        setWalletMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'var(--error, #ef4444)',
                        fontSize: '14px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-container-high)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
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
    </nav>
  );
};

export default Navbar;
