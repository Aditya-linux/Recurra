export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // Mock analytics event tracking
  console.log(`[Analytics Event]: ${eventName}`, properties || {});
  // In a real implementation, this would send data to Mixpanel, Google Analytics, PostHog, etc.
};

export const trackPageView = (path: string) => {
  // Mock page view tracking
  console.log(`[Analytics PageView]: ${path}`);
};
