import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';

const HERO_VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4';

/* ─── Brand Marquee Data ─── */
const brands = [
  {
    name: 'Stripe',
    style: {
      fontFamily: 'Georgia, serif',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontSize: '15px',
    },
  },
  {
    name: 'Coinbase',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontWeight: 900,
      letterSpacing: '0.08em',
      fontSize: '13px',
      textTransform: 'uppercase' as const,
    },
  },
  {
    name: 'Uniswap',
    style: {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontWeight: 600,
      letterSpacing: '0.01em',
      fontSize: '15px',
      fontStyle: 'italic',
    },
  },
  {
    name: 'Aave',
    style: {
      fontFamily: '"Courier New", monospace',
      fontWeight: 700,
      letterSpacing: '0.12em',
      fontSize: '13px',
      textTransform: 'uppercase' as const,
    },
  },
  {
    name: 'Compound',
    style: {
      fontFamily: 'Palatino, "Book Antiqua", serif',
      fontWeight: 400,
      letterSpacing: '-0.01em',
      fontSize: '16px',
    },
  },
  {
    name: 'MakerDAO',
    style: {
      fontFamily: 'Impact, "Arial Narrow", sans-serif',
      fontWeight: 400,
      letterSpacing: '0.04em',
      fontSize: '14px',
    },
  },
  {
    name: 'Chainlink',
    style: {
      fontFamily: 'Verdana, sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      fontSize: '13px',
    },
  },
];

const BrandMarquee: React.FC = () => {
  return (
    <div className="mt-8 md:mt-24 w-full max-w-md overflow-hidden">
      <div className="marquee-track">
        {/* Render twice for seamless loop */}
        {[...brands, ...brands].map((brand, i) => (
          <span
            key={`${brand.name}-${i}`}
            className="mx-7 shrink-0 text-black/60 whitespace-nowrap"
            style={brand.style}
          >
            {brand.name}
          </span>
        ))}
      </div>
    </div>
  );
};

const HeroSection: React.FC = () => {
  const { openModal } = useWallet();

  return (
    <section className="flex-1 px-3 md:px-6 pt-20 pb-3 md:pb-6 flex items-end">
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ height: 'calc(100dvh - 96px)' }}
      >
        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
          src={HERO_VIDEO_SRC}
        />

        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col items-start justify-start h-full p-5 pt-16 md:p-12 md:pt-36">
          <h1
            className="text-black text-3xl sm:text-5xl md:text-6xl font-medium leading-tight max-w-2xl mb-4"
            style={{ letterSpacing: '-0.04em' }}
          >
            Web3 Recurring
            <br />
            Payments
          </h1>

          <p
            className="text-black/70 text-sm md:text-lg max-w-md mb-6 md:mb-8 leading-relaxed"
            style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
          >
            Rekura brings automated subscriptions to Web3. A decentralized B2B and B2C platform built on the Stellar Soroban network.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('recurra_intent', 'user');
                openModal();
              }}
              className="inline-flex items-center gap-3 bg-black text-white text-sm md:text-lg font-medium pl-6 pr-2 py-2 md:pl-8 rounded-full hover:bg-gray-800 transition-colors duration-200"
            >
              Subscribe Plan
              <span className="bg-white rounded-full p-2 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-black" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('recurra_intent', 'merchant');
                openModal();
              }}
              className="inline-flex items-center gap-3 bg-white text-black border border-black/10 text-sm md:text-lg font-medium px-6 py-3 md:px-8 md:py-3.5 rounded-full hover:bg-gray-50 transition-colors duration-200"
            >
              Be a Merchant
            </button>
          </div>

          {/* Brand Marquee */}
          <BrandMarquee />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
