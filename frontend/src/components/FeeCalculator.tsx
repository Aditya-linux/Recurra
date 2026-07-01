import React, { useState, useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Coffee, MonitorPlay, Plane, TrendingUp, ChevronDown, ChevronUp, Share2, X, ShoppingBag } from 'lucide-react';

const SmoothNumber: React.FC<{ value: number; prefix?: string }> = ({ value, prefix = '' }) => {
  const spring = useSpring(value, { stiffness: 300, damping: 25 }); // Snappy spring
  const display = useTransform(spring, (current) => `${prefix}${Math.round(current).toLocaleString()}`);
  
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
};

const savingsContexts = {
  tier1: [
    "A cutting chai", "A cup of filter coffee", "A roadside vada pav", "A samosa and chai", 
    "A cold coffee", "A fresh sugarcane juice", "A coconut water", "A kulfi", "A scoop of ice cream", 
    "One metro ride", "A local train pass", "An auto ride", "Airport metro fare", "A chocolate brownie",
    "A pastry", "A sandwich", "A frankie roll", "A plate of pani puri"
  ],
  tier2: [
    "A bubble tea", "A plate of momos", "A dosa breakfast", "A pav bhaji dinner", "A pizza slice", 
    "A burger combo", "A biryani meal", "A thali lunch", "A Zomato lunch", "A Swiggy dinner", 
    "A late-night food order", "A café date", "A dessert night", "A movie popcorn combo", 
    "Fuel for a day", "Bike petrol refill", "EV charging session", "Highway tolls", 
    "A paperback book", "A new phone case", "A tempered glass", "A charging cable",
    "A gym day pass", "New gym gloves", "Sports socks", "A T-shirt", "Mobile recharge",
    "Grocery run", "One less money worry", "Every rupee counts"
  ],
  tier3: [
    "A brunch with friends", "A buffet lunch", "Fuel for a week", "One month of Netflix", 
    "One month of Spotify", "One month of YouTube Premium", "One month of Swiggy One", 
    "One month of Zomato Gold", "One month of Amazon Prime", "One month of ChatGPT", 
    "One month of Claude", "One month of Canva Pro", "One month of Notion AI", "A fast charger", 
    "Wireless earbuds", "A Bluetooth speaker", "A power bank", "A laptop sleeve", "A gaming mouse", 
    "Two bestselling books", "A Kindle ebook bundle", "An online course", "A Udemy sale purchase", 
    "A LeetCode subscription", "A domain name", "A VPS for a month", "One month gym membership", 
    "Yoga classes", "A protein tub", "Running shoes", "A yoga mat", "A fitness tracker band", 
    "A pair of jeans", "Sneakers", "Formal shoes", "Sunglasses", "A hoodie", "A backpack", 
    "A wallet", "A perfume", "A bouquet of flowers", "A birthday cake", "A birthday gift", 
    "Anniversary dinner", "Rakhi gift", "Diwali shopping", "Eid sweets", "Christmas gift", 
    "Valentine's surprise", "Friendship Day gift", "One OTT night", "A movie ticket", 
    "Two movie tickets", "IMAX tickets", "Bowling with friends", "Arcade games", "Escape room tickets", 
    "Stand-up comedy show", "Concert ticket", "Music festival pass", "Weekend café hopping", 
    "Beach day snacks", "A picnic", "Passport application", "Visa fees", "Travel insurance", 
    "Airport lounge pass", "Cabin luggage", "Travel backpack", "International SIM", "Weekly groceries", 
    "New bedsheets", "Kitchen essentials", "Coffee machine", "Study chair", "Home décor", 
    "Indoor plants", "PlayStation game", "Nintendo game", "Steam sale haul", "Ring light", 
    "Coffee for the whole team", "Pizza party", "Team lunch", "Office snacks", "Festival treats", 
    "Ice cream for everyone", "Family dinner", "Sunday brunch", "Friends' reunion", 
    "Celebration dinner", "Your first ₹1,000", "Your first ₹5,000", "A premium coffee date", 
    "A bookstore haul", "One month of cloud storage", "Business lunch", "Rainy day fund", 
    "Weekend happiness fund", "Tiny step, big future", "Savings unlocked"
  ],
  tier4: [
    "One-day road trip", "Lonavala drive", "Alibaug ferry", "Goa hostel stay", "Goa flight fund", 
    "Udaipur getaway", "Jaipur weekend", "Pondicherry trip", "Coorg vacation", "Flight upgrade", 
    "Hotel booking", "Your first ₹10,000", "Your first ₹25,000", "Your first ₹50,000", 
    "Halfway there", "Savings streak unlocked", "Budgeting level up", "Money milestone reached", 
    "Weekend shopping spree", "AI subscription fund", "New office chair", "Better work setup", 
    "Digital nomad starter pack", "Side hustle investment", "Startup incorporation fee", 
    "Logo design budget", "Product launch fund", "Marketing budget", "First ad campaign", 
    "Landing page budget", "Startup domain renewal", "Business cards", "Networking event ticket", 
    "Hackathon registration", "Crypto DCA fund", "Bitcoin stacking fund", "Ethereum gas fund", 
    "Stablecoin savings", "Hardware wallet fund", "TradingView subscription", "Developer API credits", 
    "Cloud hosting bill", "AI API credits", "Build your MVP", "First freelance payment goal", 
    "Client appreciation gift", "Freelancer toolkit", "Coworking pass", "Productivity upgrade", 
    "New portfolio website", "Creator subscription stack", "Professional photoshoot", 
    "LinkedIn Premium month", "Future you says thanks", "Freedom fund growing", 
    "Keep the streak alive", "You're getting closer", "A mechanical keyboard", "A coding course", 
    "A Coursera certificate", "A cricket bat", "A watch", "Goa weekend trip", "Monthly groceries", 
    "Air fryer", "Mixer grinder", "Work desk", "Monitor upgrade", "Action camera", "Gaming headset", 
    "Smartwatch", "Noise-cancelling headphones", "External SSD", "Camera lens", "Studio microphone"
  ],
  tier5: [
    "Goa beach vacation", "Kerala backwaters", "Manali escape", "Shimla holiday", "Kashmir adventure", 
    "Leh bike trip", "Northeast backpacking", "International vacation fund", "Your first SIP", 
    "Emergency fund start", "One month rent", "Security deposit", "Electricity bill", "Wi-Fi bill", 
    "DSLR camera", "Drone fund", "Gaming monitor", "Graphics card fund", "New smartphone", 
    "MacBook fund", "Laptop upgrade", "Tablet fund", "Content creator kit", "Your first ₹1 lakh"
  ]
};

export const FeeCalculator: React.FC = () => {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [volume, setVolume] = useState<number>(400000); // Default to ~4L INR
  const [txCount, setTxCount] = useState<number>(100);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [pulseKey, setPulseKey] = useState<number>(0);
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  
  // Context state so it only changes on release, not continuously during drag
  const [context, setContext] = useState({ text: "A weekend trip to Goa", icon: <Plane size={16} /> });

  const isINR = currency === 'INR';
  const prefix = isINR ? '₹' : '$';

  // Average transaction value used to estimate tx count from volume
  const avgTxValue = isINR ? 4000 : 50;

  // Stripe typical: 2.9% + fixed fee
  const stripeFixed = isINR ? 25 : 0.30;
  const stripeFee = (volume * 0.029) + (txCount * stripeFixed);
  
  // Rekura on-chain fee: ~$0.01 / ₹0.8 per tx average
  const rekuraFixed = isINR ? 0.8 : 0.01;
  const rekuraFee = txCount * rekuraFixed;
  
  const savings = stripeFee - rekuraFee;
  const annualSavings = savings * 12;

  // Milestone haptics
  const prevSavingsRef = useRef(annualSavings);

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      const milestones = isINR ? [8000, 40000, 80000, 200000, 400000, 800000] : [100, 500, 1000, 2500, 5000, 10000];
      for (const m of milestones) {
        if (prevSavingsRef.current < m && annualSavings >= m) {
          navigator.vibrate(50); // Light haptic feedback
        } else if (prevSavingsRef.current >= m && annualSavings < m) {
          navigator.vibrate(50);
        }
      }
    }
    prevSavingsRef.current = annualSavings;
  }, [annualSavings, isINR]);

  // Trigger pulse effect when dragging stops
  useEffect(() => {
    if (!isDragging && hasInteracted) {
      setPulseKey(k => k + 1);
    }
  }, [isDragging, hasInteracted]);

  // Update contextual string only when user stops dragging
  useEffect(() => {
    if (!isDragging) {
      const inrValue = isINR ? annualSavings : annualSavings * 83;
      let pool: string[];
      let icon = <Coffee size={16} />;
      
      if (inrValue <= 100) {
        pool = savingsContexts.tier1;
        icon = <Coffee size={16} />;
      } else if (inrValue <= 500) {
        pool = savingsContexts.tier2;
        icon = <Coffee size={16} />;
      } else if (inrValue <= 2000) {
        pool = savingsContexts.tier3;
        icon = <ShoppingBag size={16} />;
      } else if (inrValue <= 10000) {
        pool = savingsContexts.tier4;
        icon = <MonitorPlay size={16} />;
      } else {
        pool = savingsContexts.tier5;
        icon = <Plane size={16} />;
      }

      // Pseudo-random but stable selection based on the savings value itself
      const seed = Math.floor(annualSavings * 100) + volume;
      const index = seed % pool.length;
      
      setContext({ text: pool[index], icon });
    }
  }, [annualSavings, isDragging, isINR, volume]);

  const handleCurrencyToggle = (newCurrency: 'INR' | 'USD') => {
    if (currency === newCurrency) return;
    setCurrency(newCurrency);
    if (newCurrency === 'INR') {
      const newVol = Math.round(volume * 83);
      setVolume(newVol);
      setTxCount(Math.max(1, Math.floor(newVol / 4000)));
    } else {
      const newVol = Math.round(volume / 83);
      setVolume(newVol);
      setTxCount(Math.max(1, Math.floor(newVol / 50)));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasInteracted) setHasInteracted(true);
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    setTxCount(Math.max(1, Math.floor(newVolume / avgTxValue)));
  };

  const setPreset = (val: number) => {
    if (!hasInteracted) setHasInteracted(true);
    setVolume(val);
    setTxCount(Math.max(1, Math.floor(val / avgTxValue)));
    setPulseKey(k => k + 1); // trigger highlight immediately
  };

  const getPercentile = (v: number) => {
    // Fictional percentile math for benchmarking nudge
    const usdEquiv = isINR ? v / 83 : v;
    if (usdEquiv >= 50000) return 1;
    if (usdEquiv >= 10000) return 5;
    if (usdEquiv >= 5000) return 15;
    if (usdEquiv >= 2000) return 30;
    return 60;
  };

  const presetSmall = isINR ? 150000 : 2000;
  const presetGrowing = isINR ? 600000 : 8000;
  const presetEnterprise = isINR ? 4000000 : 50000;

  const sliderMin = isINR ? 10000 : 100;
  const sliderMax = isINR ? 10000000 : 100000;
  const sliderStep = isINR ? 10000 : 100;

  return (
    <div className="card fee-calc-card flex flex-col gap-8" style={{ background: 'var(--surface-container-high)', padding: '48px', borderRadius: '24px', border: '1px solid var(--glass-border)', position: 'relative' }}>
      
      <div className="fee-calc-currency-toggle" style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', background: 'var(--surface-container-highest)', borderRadius: '24px', padding: '4px', border: '1px solid var(--glass-border)' }}>
        <button 
          onClick={() => handleCurrencyToggle('INR')}
          style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600, borderRadius: '20px', transition: 'all 0.2s', background: isINR ? 'var(--on-surface)' : 'transparent', color: isINR ? 'var(--surface)' : 'var(--on-surface-variant)' }}
        >
          ₹ INR
        </button>
        <button 
          onClick={() => handleCurrencyToggle('USD')}
          style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600, borderRadius: '20px', transition: 'all 0.2s', background: !isINR ? 'var(--on-surface)' : 'transparent', color: !isINR ? 'var(--surface)' : 'var(--on-surface-variant)' }}
        >
          $ USD
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <h3 className="text-h3" style={{ marginBottom: '12px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--on-surface)' }}>Calculate Your Savings</h3>
        <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.6 }}>
          See how much you save annually by switching from legacy processors to on-chain settlements.
        </p>
      </div>

      <div className="flex flex-col gap-4 mt-2 relative">
        <div className="fee-calc-preset-group flex gap-2 justify-center mb-4">
          <button onClick={() => setPreset(presetSmall)} className="px-3 py-1 text-xs font-semibold rounded-full border border-[var(--glass-border)] bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors">Small Biz</button>
          <button onClick={() => setPreset(presetGrowing)} className="px-3 py-1 text-xs font-semibold rounded-full border border-[var(--glass-border)] bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors">Growing Startup</button>
          <button onClick={() => setPreset(presetEnterprise)} className="px-3 py-1 text-xs font-semibold rounded-full border border-[var(--glass-border)] bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors">Enterprise</button>
        </div>

        <div className="flex justify-between items-center mb-2">
          <span style={{ fontWeight: 600, color: 'var(--on-surface)', fontSize: '15px' }}>Monthly Processing Volume</span>
          <span className="fee-calc-volume-value" style={{ color: 'var(--on-surface)', fontWeight: 700, fontSize: '32px', letterSpacing: '-0.03em' }}>
            <SmoothNumber value={volume} prefix={prefix} />
          </span>
        </div>
        
        <div style={{ position: 'relative' }}>
          <input 
            type="range" 
            min={sliderMin} 
            max={sliderMax} 
            step={sliderStep} 
            value={volume} 
            onChange={handleVolumeChange}
            onPointerDown={() => setIsDragging(true)}
            onPointerUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            style={{ width: '100%', accentColor: 'var(--on-surface)', height: '4px', borderRadius: '4px', cursor: 'grab', background: 'var(--surface-variant)' }}
          />
        </div>
        
        <div className="flex justify-between" style={{ fontSize: '12px', color: 'var(--on-surface-variant)', fontWeight: 500 }}>
          <span>{prefix}{isINR ? '10k' : '100'}</span>
          <span>{prefix}{isINR ? '1Cr' : '100k'}</span>
        </div>
      </div>

      <div className="fee-calc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '8px' }}>
        <div key={`legacy-${pulseKey}`} className="flex flex-col items-center justify-center relative overflow-hidden" style={{ padding: '28px', background: 'var(--surface-container-highest)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
          <div style={{ position: 'relative', zIndex: 1, color: 'var(--on-surface-variant)', fontSize: '13px', marginBottom: '12px', fontWeight: 500 }}>Legacy Processor (Monthly)</div>
          <div className="fee-calc-processor-value" style={{ position: 'relative', zIndex: 1, fontSize: '32px', fontWeight: 700, color: '#ff5c5c', letterSpacing: '-0.03em' }}>
            <SmoothNumber value={stripeFee} prefix={prefix} />
          </div>
          <div style={{ position: 'relative', zIndex: 1, fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '8px', opacity: 0.8 }}>~2.9% + {prefix}{stripeFixed.toFixed(2)} / tx</div>
        </div>
        
        <div key={`rekura-${pulseKey}`} className="flex flex-col items-center justify-center relative overflow-hidden" style={{ padding: '28px', background: 'var(--surface-container-highest)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
          <div style={{ position: 'absolute', right: '16px', top: '16px', color: 'var(--on-surface-variant)', opacity: 0.5 }}>
            <TrendingUp size={20} />
          </div>
          <div style={{ color: 'var(--on-surface-variant)', fontSize: '13px', marginBottom: '12px', fontWeight: 600 }}>Rekura Network (Monthly)</div>
          <div className="fee-calc-processor-value" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--emerald-500)', letterSpacing: '-0.03em' }}>
            <SmoothNumber value={rekuraFee} prefix={prefix} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', opacity: 0.8, marginTop: '8px' }}>~{prefix}{rekuraFixed.toFixed(2)} / tx</div>
        </div>
      </div>

      <div className="savings-shimmer" style={{ padding: '32px', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--glass-border)', position: 'relative', overflow: 'hidden', marginTop: '8px', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 2 }}>
          <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-[var(--surface-container-highest)] text-[var(--on-surface)] border border-[var(--glass-border)]">
            Top {getPercentile(volume)}% saver
          </span>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--on-surface)' }}>Annual Savings</div>
          <motion.div 
            className="fee-calc-savings-value"
            style={{ fontSize: '56px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--on-surface)' }}
          >
            <SmoothNumber value={annualSavings} prefix={prefix} />
          </motion.div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={context.text}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center gap-2 mt-3"
              style={{ color: 'var(--on-surface)', fontSize: '14px', fontWeight: 500 }}
            >
              {context.icon}
              <span>{context.text}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {annualSavings > (isINR ? 40000 : 500) && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center mt-[-12px] relative z-10"
        >
          <button 
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--on-surface)] hover:opacity-80 text-[var(--surface)] rounded-full font-semibold text-sm transition-opacity shadow-lg cursor-pointer"
          >
            <Share2 size={16} /> Share my savings
          </button>
        </motion.div>
      )}

      <div className="flex flex-col items-center mt-1 relative z-10">
        <button 
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="flex items-center gap-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] text-sm font-medium transition-colors"
        >
          See the math {showBreakdown ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </button>

        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full overflow-hidden mt-4"
            >
              <div className="p-4 rounded-xl bg-[var(--surface-container-highest)] border border-[var(--glass-border)] text-sm text-[var(--on-surface-variant)] flex flex-col gap-3">
                <div className="flex justify-between border-b border-[var(--glass-border)] pb-2">
                  <span>Estimated Monthly Transactions</span>
                  <span className="font-semibold text-[var(--on-surface)]">{txCount.toLocaleString()} txs</span>
                </div>
                <div className="flex justify-between">
                  <span>Legacy Processing Fee (2.9%)</span>
                  <span>{prefix}{(volume * 0.029).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--glass-border)] pb-2">
                  <span>Legacy Fixed Fee ({prefix}{stripeFixed.toFixed(2)}/tx)</span>
                  <span>{prefix}{(txCount * stripeFixed).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rekura On-chain Fee (~{prefix}{rekuraFixed.toFixed(2)}/tx)</span>
                  <span className="text-[var(--emerald-500)] font-semibold">{prefix}{rekuraFee.toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 rounded-[24px]"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm relative overflow-hidden flex flex-col p-8 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, #1f1f1f 0%, #0a0a0a 100%)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'linear-gradient(125deg, transparent 20%, rgba(255,255,255,0.4) 40%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.2) 60%, transparent 80%)' }} />
              <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] pointer-events-none opacity-10 animate-[spin_20s_linear_infinite]" style={{ background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.8), transparent)' }} />
              
              <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-20 bg-black/20 rounded-full p-1">
                <X size={20} />
              </button>
              
              <div className="text-center mb-8 relative z-10 mt-4">
                <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
                  My Savings NFT
                </div>
                <div className="text-6xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 30px rgba(255,255,255,0.3)' }}>
                  <SmoothNumber value={annualSavings} prefix={prefix} />
                </div>
                <p className="text-white/60 text-sm mt-3 font-medium">Saved annually on Rekura</p>
              </div>
              
              <div className="share-modal-grid grid grid-cols-5 gap-3 relative z-10">
                <a href={`https://wa.me/?text=I%20just%20found%20out%20I'm%20losing%20${prefix}${Math.round(annualSavings).toLocaleString()}/year%20to%20payment%20processors.%20@RekuraNetwork%20showed%20me%20the%20light.`} target="_blank" rel="noreferrer" className="flex flex-col items-center group">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#25D366]/20 transition-all group-hover:scale-110 group-hover:border-[#25D366]/50 text-white group-hover:text-[#25D366]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                  </div>
                </a>
                <a href={`https://x.com/intent/tweet?text=I%20just%20found%20out%20I'm%20losing%20${prefix}${Math.round(annualSavings).toLocaleString()}/year%20to%20payment%20processors.%20@RekuraNetwork%20showed%20me%20the%20light.`} target="_blank" rel="noreferrer" className="flex flex-col items-center group">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all group-hover:scale-110 group-hover:border-white/50 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
                  </div>
                </a>
                <a href={`https://pinterest.com/pin/create/button/?url=https://rekura.network&description=I%20just%20found%20out%20I'm%20losing%20${prefix}${Math.round(annualSavings).toLocaleString()}/year%20to%20payment%20processors.`} target="_blank" rel="noreferrer" className="flex flex-col items-center group">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#E60023]/20 transition-all group-hover:scale-110 group-hover:border-[#E60023]/50 text-white group-hover:text-[#E60023]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.951-7.252 4.163 0 7.398 2.967 7.398 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.624 0 12.017 0z"/></svg>
                  </div>
                </a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=https://rekura.network`} target="_blank" rel="noreferrer" className="flex flex-col items-center group">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#1877F2]/20 transition-all group-hover:scale-110 group-hover:border-[#1877F2]/50 text-white group-hover:text-[#1877F2]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                  </div>
                </a>
                <a href={`https://www.instagram.com/`} target="_blank" rel="noreferrer" className="flex flex-col items-center group">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#E4405F]/20 transition-all group-hover:scale-110 group-hover:border-[#E4405F]/50 text-white group-hover:text-[#E4405F]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                  </div>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
