import React from 'react';
import { motion, useInView, useSpring } from 'framer-motion';

// Common Transition
export const transitionSpring = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
  mass: 1,
};

export const transitionEase = {
  type: 'tween',
  ease: [0.16, 1, 0.3, 1], // ease-out-expo
  duration: 0.6,
};

// Page Wrapper for route transitions
export const PageWrapper: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={transitionEase}
      className={className}
      {...props as any}
    >
      {children}
    </motion.div>
  );
};

// Fade In
export const FadeIn: React.FC<React.HTMLAttributes<HTMLDivElement> & { delay?: number }> = ({ children, delay = 0, className, ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ ...transitionEase, delay }}
      className={className}
      {...props as any}
    >
      {children}
    </motion.div>
  );
};

// Staggered Container
export const StaggerContainer: React.FC<React.HTMLAttributes<HTMLDivElement> & { staggerDelay?: number }> = ({ children, className, staggerDelay = 0.1, ...props }) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      }
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
      {...props as any}
    >
      {children}
    </motion.div>
  );
};

// Stagger Item (Must be direct child of StaggerContainer)
export const StaggerItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => {
  const item = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: transitionEase }
  };

  return (
    <motion.div variants={item} initial="hidden" animate="show" className={className} {...props as any}>
      {children}
    </motion.div>
  );
};

// Hover Card — no pop/lift, just a pass-through wrapper
export const HoverCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => {
  return (
    <motion.div
      className={className}
      {...props as any}
    >
      {children}
    </motion.div>
  );
};


// Count Up Metric
export const CountUp: React.FC<{ to: number; duration?: number; className?: string; prefix?: string; suffix?: string }> = ({ to, duration = 2, className, prefix = '', suffix = '' }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  const springValue = useSpring(0, {
    duration: duration * 1000,
    bounce: 0
  });

  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (isInView) {
      springValue.set(to);
    }
  }, [isInView, springValue, to]);

  React.useEffect(() => {
    return springValue.onChange((latest) => {
      setDisplay(Math.floor(latest));
    });
  }, [springValue]);

  return (
    <span ref={ref} className={className}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
};
