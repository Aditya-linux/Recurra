import React from 'react';
import LandingNavbar from '../components/landing/LandingNavbar';
import HeroSection from '../components/landing/HeroSection';
import InfoSection from '../components/landing/InfoSection';
import BackedBySection from '../components/landing/BackedBySection';
import UseCasesSection from '../components/landing/UseCasesSection';
import { FeeCalculator } from '../components/FeeCalculator';

const Landing: React.FC = () => {
  return (
    <div className="flex flex-col bg-[#F5F5F5]">
      {/* ─── Section 1: Navbar + Hero (full screen) ─── */}
      <div className="h-screen min-h-[600px] flex flex-col overflow-hidden relative">
        <LandingNavbar />
        <HeroSection />
      </div>

      {/* ─── Section 2: Meet Rekura ─── */}
      <InfoSection />

      {/* ─── Section 3: Backed By ─── */}
      <BackedBySection />

      {/* ─── Section 4: Use Cases ─── */}
      <UseCasesSection />

      {/* ─── Section 5: Fee Calculator ─── */}
      <section className="bg-[#F5F5F5] px-4 md:px-6 py-12 md:py-24">
        <div className="max-w-[88rem] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="md:pr-12 md:pt-2">
              <p className="text-black/60 text-sm mb-2">Transparent Pricing</p>
              <h2
                className="text-black text-3xl md:text-5xl lg:text-6xl font-medium leading-none mb-6"
                style={{ letterSpacing: '-0.04em' }}
              >
                Fee Calculator
              </h2>
              <p className="text-black/60 text-base leading-relaxed max-w-sm">
                See exactly how much you save compared to traditional payment
                processors. No hidden fees, no surprises.
              </p>
            </div>
            {/* Calculator Component */}
            <div className="w-full">
              <FeeCalculator />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
