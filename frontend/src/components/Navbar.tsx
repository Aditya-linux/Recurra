import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

const Navbar: React.FC = () => {
  const { walletAddress, userRole, openModal, disconnect } = useWallet();
  const isDark = false;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [buyXlmOpen, setBuyXlmOpen] = useState(false);
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buyXlmRef = useRef<HTMLDivElement>(null);

  const getNavClass = ({ isActive }: { isActive: boolean }) => {
    return `text-nav-link transition-all ${isActive ? 'active text-black' : 'text-black/50 hover:text-black'}`;
  };

  const closeMenu = () => setMobileOpen(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setWalletMenuOpen(false);
      }
      if (buyXlmRef.current && !buyXlmRef.current.contains(event.target as Node)) {
        setBuyXlmOpen(false);
      }
    };
    if (walletMenuOpen || buyXlmOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [walletMenuOpen, buyXlmOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleFeedbackClick = () => {
    if (walletAddress) {
      window.open(`https://docs.google.com/forms/d/e/1FAIpQLSeKboVY1mS0tC243RN6CuOxAsIUX5a3Ii0qHnSAtCOxKikuaA/viewform?usp=pp_url&entry.783302326=${walletAddress}`, '_blank');
    } else {
      window.open('https://docs.google.com/forms/d/e/1FAIpQLSeKboVY1mS0tC243RN6CuOxAsIUX5a3Ii0qHnSAtCOxKikuaA/viewform', '_blank');
    }
  };

  const xlmExchanges = [
    { name: 'Lobstr', url: 'https://lobstr.co', description: 'Best for Stellar wallets', icon: '🌟' },
    { name: 'Coinbase', url: 'https://www.coinbase.com/price/stellar', description: 'Popular & beginner-friendly', icon: '🔵' },
    { name: 'Binance', url: 'https://www.binance.com/en/trade/XLM_USDT', description: 'Largest global exchange', icon: '🟡' },
  ];

  const showNavLinks = walletAddress && location.pathname !== '/';
  const isMerchant = userRole === 'merchant';

  return (
    <>
      {/* ─── Desktop / Tablet Top Navbar ─── */}
      <div className="navbar-wrapper">
        <nav className="navbar">
          <Link to="/" className="logo-text" onClick={closeMenu} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginRight: '60px' }}>
            <img src={isDark ? '/logo-white.png' : '/logo-black.png'} alt="Rekura Logo" className="h-7 md:h-7" style={{ transform: 'scale(2)', transformOrigin: 'left center' }} />
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
              onClick={handleFeedbackClick}
              className="navbar-icon-btn desktop-only"
              title="Send Feedback"
            >
              <span className="material-symbols-outlined">feedback</span>
            </button>

            {/* Buy XLM Dropdown — replaces MoonPay */}
            <div style={{ position: 'relative' }} ref={buyXlmRef} className="desktop-only">
              <button
                onClick={() => setBuyXlmOpen(!buyXlmOpen)}
                className="hover-scale"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  height: '40px', padding: '0 16px', borderRadius: '20px', marginRight: '8px',
                  background: 'transparent', border: '1px solid var(--outline-variant)',
                  cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px', fontWeight: 700,
                  color: '#000', whiteSpace: 'nowrap'
                }}
                title="Buy XLM"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>currency_exchange</span>
                Buy XLM
              </button>
              {buyXlmOpen && (
                <div className="dropdown-menu" style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  zIndex: 100,
                  minWidth: '280px',
                }}>
                  <div style={{ padding: '12px 16px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(0,0,0,0.4)' }}>
                    Buy XLM from an Exchange
                  </div>
                  {xlmExchanges.map((exchange) => (
                    <button
                      key={exchange.name}
                      className="dropdown-item"
                      onClick={() => {
                        window.open(exchange.url, '_blank', 'noopener,noreferrer');
                        setBuyXlmOpen(false);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px' }}
                    >
                      <span style={{ fontSize: '20px', lineHeight: 1 }}>{exchange.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{exchange.name}</span>
                        <span style={{ fontSize: '11px', opacity: 0.5, fontWeight: 500 }}>{exchange.description}</span>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', opacity: 0.3, marginLeft: 'auto' }}>open_in_new</span>
                    </button>
                  ))}
                  <div style={{ padding: '8px 16px 12px', fontSize: '11px', color: 'rgba(0,0,0,0.35)', fontWeight: 500, lineHeight: 1.4 }}>
                    Purchase XLM and send it to your connected wallet address.
                  </div>
                </div>
              )}
            </div>

            {walletAddress ? (
              <div style={{ position: 'relative' }} ref={dropdownRef} className="desktop-only">
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-black/5 transition-colors"
                  onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                  style={{ cursor: 'pointer', color: '#000000', border: '1px solid rgba(0, 0, 0, 0.1)', background: 'white' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', opacity: 0.8 }}>account_balance_wallet</span>
                  <span className="font-bold text-sm">{walletAddress}</span>
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
              <span className="material-symbols-outlined" style={{ fontSize: '18px', opacity: 0.8, marginRight: '8px' }}>account_balance_wallet</span>
              <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{walletAddress}</span>
            </div>
          )}
          <button className="mobile-sheet-item" onClick={() => { handleFeedbackClick(); closeMenu(); }}>
            <span className="material-symbols-outlined">feedback</span>
            Send Feedback
          </button>
          {/* Buy XLM — mobile */}
          <button className="mobile-sheet-item" onClick={() => { window.open('https://lobstr.co', '_blank', 'noopener,noreferrer'); closeMenu(); }}>
            <span className="material-symbols-outlined">currency_exchange</span>
            Buy XLM (Lobstr)
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

    </>
  );
};

export default Navbar;
