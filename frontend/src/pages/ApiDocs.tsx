import React, { useState } from 'react';
import { Key, Server, Webhook, FileJson } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageWrapper, FadeIn } from '../components/ui/animations';

const ApiDocs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'authentication' | 'subscriptions' | 'webhooks'>('authentication');

  const codeSnippets = {
    authentication: `// Initialize Recurra SDK
import { Recurra } from '@recurra/sdk';

const recurra = new Recurra({
  apiKey: 'sk_test_12345...',
  environment: 'testnet'
});

// Use JWT for frontend requests
const jwt = await recurra.auth.createSession('G...');
`,
    subscriptions: `// Create a new subscription
const subscription = await recurra.subscriptions.create({
  planId: 'plan_789xyz',
  walletAddress: 'G...A1B2',
  returnUrl: 'https://myapp.com/success'
});

console.log('Redirect to:', subscription.checkoutUrl);
`,
    webhooks: `// Handle incoming webhooks in Express
app.post('/webhooks/recurra', (req, res) => {
  const signature = req.headers['x-recurra-signature'];
  const payload = req.rawBody;
  
  try {
    const event = recurra.webhooks.constructEvent(
      payload, 
      signature, 
      process.env.RECURRA_WEBHOOK_SECRET
    );
    
    if (event.type === 'payment.executed') {
      console.log('Payment received:', event.data.amount);
    }
    
    res.json({received: true});
  } catch (err) {
    res.status(400).send(\`Webhook Error: \${err.message}\`);
  }
});
`
  };

  return (
    <PageWrapper>
      <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
        <section className="container mx-auto px-6 mt-10 max-w-7xl">
          <FadeIn delay={0.1}>
            <div className="mb-12">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>
                API Reference
              </h1>
              <p className="mt-4 text-lg text-black/60">
                Integrate Recurra into your platform in minutes. Powerful APIs for recurring payments on Stellar.
              </p>
            </div>
          </FadeIn>

          <div className="flex flex-col lg:flex-row lg:space-x-8">
            {/* Sidebar */}
            <div className="mb-8 w-full shrink-0 lg:mb-0 lg:w-64">
              <FadeIn delay={0.2}>
                <nav className="space-y-2 bg-white border border-black/5 rounded-3xl p-3 shadow-sm">
                  <button
                    onClick={() => setActiveTab('authentication')}
                    className={`flex w-full items-center rounded-2xl px-4 py-3.5 text-left font-semibold transition ${
                      activeTab === 'authentication' ? 'bg-black text-white' : 'text-black/60 hover:bg-[#F5F5F5] hover:text-black'
                    }`}
                  >
                    <Key className={`mr-3 h-5 w-5 ${activeTab === 'authentication' ? 'text-white' : 'text-black/40'}`} /> Authentication
                  </button>
                  <button
                    onClick={() => setActiveTab('subscriptions')}
                    className={`flex w-full items-center rounded-2xl px-4 py-3.5 text-left font-semibold transition ${
                      activeTab === 'subscriptions' ? 'bg-black text-white' : 'text-black/60 hover:bg-[#F5F5F5] hover:text-black'
                    }`}
                  >
                    <Server className={`mr-3 h-5 w-5 ${activeTab === 'subscriptions' ? 'text-white' : 'text-black/40'}`} /> Subscriptions
                  </button>
                  <button
                    onClick={() => setActiveTab('webhooks')}
                    className={`flex w-full items-center rounded-2xl px-4 py-3.5 text-left font-semibold transition ${
                      activeTab === 'webhooks' ? 'bg-black text-white' : 'text-black/60 hover:bg-[#F5F5F5] hover:text-black'
                    }`}
                  >
                    <Webhook className={`mr-3 h-5 w-5 ${activeTab === 'webhooks' ? 'text-white' : 'text-black/40'}`} /> Webhooks
                  </button>
                </nav>
              </FadeIn>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm transition hover:shadow-md">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Left Column: Explanations */}
                <div className="p-8 lg:p-10">
                  {activeTab === 'authentication' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <h2 className="text-2xl font-bold text-black mb-4">Authentication</h2>
                      <p className="text-black/60 mb-8 leading-relaxed">
                        Authenticate requests to our API using API keys or JWTs for frontend requests. You can generate API keys from the Merchant Dashboard.
                      </p>
                      <h3 className="text-sm font-bold text-black/40 uppercase tracking-wider mb-4">Endpoints</h3>
                      <ul className="space-y-3">
                        <li className="flex items-center text-sm p-3 rounded-2xl bg-[#F5F5F5] border border-black/5">
                          <span className="bg-blue-100 text-blue-700 font-bold font-mono px-2.5 py-1 rounded-lg mr-3 uppercase text-xs">POST</span>
                          <span className="text-black/80 font-mono font-semibold">/api/v1/auth/nonce</span>
                        </li>
                        <li className="flex items-center text-sm p-3 rounded-2xl bg-[#F5F5F5] border border-black/5">
                          <span className="bg-blue-100 text-blue-700 font-bold font-mono px-2.5 py-1 rounded-lg mr-3 uppercase text-xs">POST</span>
                          <span className="text-black/80 font-mono font-semibold">/api/v1/auth/verify</span>
                        </li>
                      </ul>
                    </motion.div>
                  )}

                  {activeTab === 'subscriptions' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <h2 className="text-2xl font-bold text-black mb-4">Subscriptions</h2>
                      <p className="text-black/60 mb-8 leading-relaxed">
                        The Subscriptions API allows you to create, manage, and retrieve recurring payments.
                      </p>
                      <h3 className="text-sm font-bold text-black/40 uppercase tracking-wider mb-4">Endpoints</h3>
                      <ul className="space-y-3">
                        <li className="flex items-center text-sm p-3 rounded-2xl bg-[#F5F5F5] border border-black/5">
                          <span className="bg-blue-100 text-blue-700 font-bold font-mono px-2.5 py-1 rounded-lg mr-3 uppercase text-xs">POST</span>
                          <span className="text-black/80 font-mono font-semibold">/api/v1/subscriptions</span>
                        </li>
                        <li className="flex items-center text-sm p-3 rounded-2xl bg-[#F5F5F5] border border-black/5">
                          <span className="bg-emerald-100 text-emerald-700 font-bold font-mono px-2.5 py-1 rounded-lg mr-3 uppercase text-xs">GET</span>
                          <span className="text-black/80 font-mono font-semibold">/api/v1/subscriptions</span>
                        </li>
                        <li className="flex items-center text-sm p-3 rounded-2xl bg-[#F5F5F5] border border-black/5">
                          <span className="bg-blue-100 text-blue-700 font-bold font-mono px-2.5 py-1 rounded-lg mr-3 uppercase text-xs">POST</span>
                          <span className="text-black/80 font-mono font-semibold">/api/v1/subscriptions/:id/cancel</span>
                        </li>
                      </ul>
                    </motion.div>
                  )}

                  {activeTab === 'webhooks' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <h2 className="text-2xl font-bold text-black mb-4">Webhooks</h2>
                      <p className="text-black/60 mb-8 leading-relaxed">
                        Webhooks allow you to receive real-time notifications about events in your Recurra account, such as successful payments or subscription cancellations.
                      </p>
                      <h3 className="text-sm font-bold text-black/40 uppercase tracking-wider mb-4">Event Types</h3>
                      <ul className="space-y-3 text-sm">
                        <li><code className="text-black/80 font-semibold bg-[#F5F5F5] border border-black/5 px-2.5 py-1.5 rounded-lg">subscription.created</code></li>
                        <li><code className="text-black/80 font-semibold bg-[#F5F5F5] border border-black/5 px-2.5 py-1.5 rounded-lg">payment.executed</code></li>
                        <li><code className="text-black/80 font-semibold bg-[#F5F5F5] border border-black/5 px-2.5 py-1.5 rounded-lg">subscription.cancelled</code></li>
                      </ul>
                    </motion.div>
                  )}
                </div>

                {/* Right Column: Code Snippets (kept dark for contrast/IDE feel) */}
                <div className="bg-gray-950 p-8 lg:p-10 flex flex-col h-full lg:min-h-[500px]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex space-x-2">
                      <div className="h-3 w-3 rounded-full bg-red-500"></div>
                      <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                      <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                    </div>
                    <div className="flex items-center text-xs font-semibold text-gray-400">
                      <FileJson className="mr-1.5 h-4 w-4" /> TypeScript
                    </div>
                  </div>
                  <pre className="flex-1 overflow-x-auto text-sm text-gray-300 font-mono leading-relaxed p-4 rounded-2xl bg-black/50 border border-gray-800">
                    <code>
                      {codeSnippets[activeTab]}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageWrapper>
  );
};

export default ApiDocs;
