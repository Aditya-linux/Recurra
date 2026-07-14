import React from 'react';
import { ArrowRight } from 'lucide-react';

const USE_CASES_VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_183428_ab5e672a-f608-4dcb-b319-f3e040f02e2d.mp4';

const UseCasesSection: React.FC = () => {
  return (
    <section className="bg-[#F5F5F5] px-6 py-24">
      <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left column — Text */}
        <div className="md:pr-12 md:pt-2">
          <p className="text-black/60 text-sm mb-2">Rekura in Practice</p>
          <h2
            className="text-black text-3xl md:text-5xl lg:text-6xl font-medium leading-none mb-6"
            style={{ letterSpacing: '-0.04em' }}
          >
            Use Cases
          </h2>
          <p className="text-black/60 text-base leading-relaxed max-w-sm">
            Rekura powers a wide range of use cases for merchants, DAOs, and SaaS platforms wanting safe, automated Web3 subscriptions.
          </p>
        </div>

        {/* Right column — Video Card */}
        <div className="relative rounded-3xl overflow-hidden min-h-[400px] md:min-h-[720px]">
          {/* Background Video */}
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            src={USE_CASES_VIDEO_SRC}
          />

          {/* Overlay Content */}
          <div className="relative z-10 p-10 md:p-12 flex flex-col h-full">
            <div>
              <h3
                className="text-black text-4xl md:text-5xl font-medium leading-tight mb-5"
                style={{ letterSpacing: '-0.03em' }}
              >
                B2B & B2C Commerce
              </h3>
              <p className="text-black/70 text-base max-w-md mb-8">
                Lift customer retention by offering Rekura, a trusted Web3 recurring payment protocol that lets your patrons subscribe to your services with zero ongoing effort.
              </p>
            </div>

            {/* "Know more" link */}
            <a
              href="#commerce"
              className="group inline-flex items-center gap-3 text-black text-base font-medium"
            >
              <span className="w-9 h-9 rounded-full bg-white/80 backdrop-blur flex items-center justify-center group-hover:bg-white transition-colors duration-200">
                <ArrowRight className="w-4 h-4 text-black" />
              </span>
              Know more
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UseCasesSection;
