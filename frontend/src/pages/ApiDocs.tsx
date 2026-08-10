import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Server, Webhook, FileJson } from 'lucide-react';

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
    <div className="pt-nav min-h-screen bg-gray-950 px-4 pb-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">API Reference</h1>
          <p className="mt-4 text-lg text-gray-400">
            Integrate Recurra into your platform in minutes. Powerful APIs for recurring payments on Stellar.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:space-x-8">
          {/* Sidebar */}
          <div className="mb-8 w-full shrink-0 lg:mb-0 lg:w-64">
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('authentication')}
                className={`flex w-full items-center rounded-lg px-4 py-3 text-left font-medium transition ${
                  activeTab === 'authentication' ? 'bg-blue-600/10 text-blue-500' : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <Key className="mr-3 h-5 w-5" /> Authentication
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`flex w-full items-center rounded-lg px-4 py-3 text-left font-medium transition ${
                  activeTab === 'subscriptions' ? 'bg-blue-600/10 text-blue-500' : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <Server className="mr-3 h-5 w-5" /> Subscriptions
              </button>
              <button
                onClick={() => setActiveTab('webhooks')}
                className={`flex w-full items-center rounded-lg px-4 py-3 text-left font-medium transition ${
                  activeTab === 'webhooks' ? 'bg-blue-600/10 text-blue-500' : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <Webhook className="mr-3 h-5 w-5" /> Webhooks
              </button>
            </nav>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/50">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left Column: Explanations */}
              <div className="p-8">
                {activeTab === 'authentication' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h2 className="text-2xl font-bold text-white mb-4">Authentication</h2>
                    <p className="text-gray-400 mb-6">
                      Authenticate requests to our API using API keys or JWTs for frontend requests. You can generate API keys from the Merchant Dashboard.
                    </p>
                    <h3 className="text-lg font-semibold text-white mb-2">Endpoints</h3>
                    <ul className="space-y-3">
                      <li className="flex items-center text-sm">
                        <span className="bg-blue-500/20 text-blue-400 font-mono px-2 py-1 rounded mr-3 uppercase text-xs">POST</span>
                        <span className="text-gray-300 font-mono">/api/v1/auth/nonce</span>
                      </li>
                      <li className="flex items-center text-sm">
                        <span className="bg-blue-500/20 text-blue-400 font-mono px-2 py-1 rounded mr-3 uppercase text-xs">POST</span>
                        <span className="text-gray-300 font-mono">/api/v1/auth/verify</span>
                      </li>
                    </ul>
                  </motion.div>
                )}

                {activeTab === 'subscriptions' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h2 className="text-2xl font-bold text-white mb-4">Subscriptions</h2>
                    <p className="text-gray-400 mb-6">
                      The Subscriptions API allows you to create, manage, and retrieve recurring payments.
                    </p>
                    <h3 className="text-lg font-semibold text-white mb-2">Endpoints</h3>
                    <ul className="space-y-3">
                      <li className="flex items-center text-sm">
                        <span className="bg-blue-500/20 text-blue-400 font-mono px-2 py-1 rounded mr-3 uppercase text-xs">POST</span>
                        <span className="text-gray-300 font-mono">/api/v1/subscriptions</span>
                      </li>
                      <li className="flex items-center text-sm">
                        <span className="bg-emerald-500/20 text-emerald-400 font-mono px-2 py-1 rounded mr-3 uppercase text-xs">GET</span>
                        <span className="text-gray-300 font-mono">/api/v1/subscriptions</span>
                      </li>
                      <li className="flex items-center text-sm">
                        <span className="bg-blue-500/20 text-blue-400 font-mono px-2 py-1 rounded mr-3 uppercase text-xs">POST</span>
                        <span className="text-gray-300 font-mono">/api/v1/subscriptions/:id/cancel</span>
                      </li>
                    </ul>
                  </motion.div>
                )}

                {activeTab === 'webhooks' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h2 className="text-2xl font-bold text-white mb-4">Webhooks</h2>
                    <p className="text-gray-400 mb-6">
                      Webhooks allow you to receive real-time notifications about events in your Recurra account, such as successful payments or subscription cancellations.
                    </p>
                    <h3 className="text-lg font-semibold text-white mb-2">Event Types</h3>
                    <ul className="list-inside list-disc space-y-2 text-sm text-gray-400">
                      <li><code className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded">subscription.created</code></li>
                      <li><code className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded">payment.executed</code></li>
                      <li><code className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded">subscription.cancelled</code></li>
                    </ul>
                  </motion.div>
                )}
              </div>

              {/* Right Column: Code Snippets */}
              <div className="border-t border-gray-800 bg-gray-950 p-6 lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex space-x-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <FileJson className="mr-1 h-3 w-3" /> TypeScript
                  </div>
                </div>
                <pre className="overflow-x-auto text-sm text-gray-300 font-mono leading-relaxed">
                  <code>
                    {codeSnippets[activeTab]}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;
