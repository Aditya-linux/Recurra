import React from 'react';
import { ArrowRight } from 'lucide-react';

const CARD_IMAGE_URL =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260423_164207_f243351d-ed59-48ec-83a0-a5e996bdbe3c.png&w=1280&q=85';

const InfoSection: React.FC = () => {
  return (
    <section className="bg-[#F5F5F5] px-6 py-24">
      <div className="max-w-[88rem] mx-auto">
        {/* Row 1: 2-Column Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16 items-start">
          {/* Left: Heading + CTA */}
          <div>
            <h2
              className="text-black text-3xl md:text-5xl font-medium leading-tight mb-8"
              style={{ letterSpacing: '-0.03em' }}
            >
              Meet Rekura.
            </h2>
            <button
              type="button"
              className="inline-flex items-center gap-3 bg-black text-white text-base font-medium pl-8 pr-2 py-2 rounded-full hover:bg-gray-800 transition-colors duration-200"
            >
              Discover it
              <span className="bg-white rounded-full p-2 flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-black" />
              </span>
            </button>
          </div>

          {/* Right: Description */}
          <p className="text-black/70 text-lg md:text-2xl lg:text-3xl leading-relaxed">
            Rekura is a decentralized recurring billing protocol that lets you process subscriptions seamlessly using smart wallets.
          </p>
        </div>

        {/* Row 2: 4-Column Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 — Image (spans 2 cols on lg) */}
          <div
            className="lg:col-span-2 rounded-2xl p-7 min-h-60 md:min-h-80 flex flex-col justify-between"
            style={{
              backgroundImage: `url(${CARD_IMAGE_URL})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <h3
              className="text-black text-2xl font-medium leading-snug"
              style={{ letterSpacing: '-0.02em' }}
            >
              Subscriptions that scale
            </h3>
            <p className="text-black/70 text-base max-w-xs">
              Gain predictable revenue by allowing users to subscribe with a single on-chain approval.
            </p>
          </div>

          {/* Card 2 — Dark solid */}
          <div
            className="rounded-2xl p-7 min-h-60 md:min-h-80 flex flex-col justify-between"
            style={{ backgroundColor: '#2B2644' }}
          >
            <h3 className="text-white text-2xl font-medium leading-snug">
              Always secure,
              <br />
              always on-chain.
            </h3>
            <p className="text-white/60 text-base">
              Keep fully decentralized with on-demand transparent ledgers — no middlemen or custody risks.
            </p>
          </div>

          {/* Card 3 — Dark solid */}
          <div
            className="rounded-2xl p-7 min-h-80 flex flex-col justify-between"
            style={{ backgroundColor: '#2B2644' }}
          >
            <h3 className="text-white text-2xl font-medium leading-snug">
              Fully
              <br />
              automated
            </h3>
            <p className="text-white/60 text-base">
              Skip the task of signing manual payments every month. Rekura's Keeper nodes pull funds automatically.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InfoSection;
