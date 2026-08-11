import React, { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, RefreshCw, Clock } from 'lucide-react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { useWallet } from '../context/WalletContext';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem } from '../components/ui/animations';


interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

const WebhookManager: React.FC = () => {
  const { walletAddress } = useWallet();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['payment.created']);

  const availableEvents = [
    'subscription.created', 'subscription.canceled', 'subscription.renewed',
    'payment.created', 'payment.failed', 'payment.completed'
  ];

  const fetchEndpoints = async () => {
    try {
      const res = await api('/webhooks');
      if (res.ok) setEndpoints(res.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (walletAddress) fetchEndpoints();
  }, [walletAddress]);

  const handleAddEndpoint = async () => {
    if (!newUrl) { toast.error('URL is required'); return; }
    if (selectedEvents.length === 0) { toast.error('Select at least one event'); return; }

    try {
      const res = await api('/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url: newUrl, events: selectedEvents, secret: crypto.randomUUID() })
      });
      if (!res.ok) throw new Error(res.error || 'Failed to create');
      
      toast.success('Webhook endpoint created successfully');
      setShowAddModal(false);
      setNewUrl('');
      fetchEndpoints();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create webhook');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook endpoint?')) return;
    try {
      const res = await api(`/webhooks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(res.error || 'Failed to delete');
      setEndpoints(endpoints.filter(e => e.id !== id));
      toast.success('Endpoint removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete endpoint');
    }
  };

  const handleTest = async (id: string) => {
    const toastId = toast.loading('Sending test ping...');
    try {
      const res = await api(`/webhooks/${id}/test`, { method: 'POST' });
      if (!res.ok) throw new Error(res.error || 'Failed to send test ping');
      
      if (res.data.status === 'success') {
        toast.success('Test ping delivered successfully', { id: toastId });
      } else {
        toast.error(`Test ping failed: ${res.data.responseStatus}`, { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send test ping', { id: toastId });
    }
  };

  return (
    <PageWrapper>
      <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
        <section className="container mx-auto px-6 mt-10 max-w-5xl">
          <FadeIn delay={0.1}>
            <div className="mb-8 flex flex-col justify-between space-y-4 sm:flex-row sm:items-end sm:space-y-0">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>
                  Webhook Integration
                </h1>
                <p className="mt-2 text-lg text-black/60">
                  Receive real-time events about your subscriptions and payments
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center rounded-2xl bg-black px-6 py-3 font-semibold text-white hover:bg-black/80 transition self-start sm:self-auto shadow-sm"
              >
                <Plus className="mr-2 h-5 w-5" /> Add Endpoint
              </button>
            </div>
          </FadeIn>

          {showAddModal && (
            <FadeIn>
              <div className="mb-10 rounded-3xl border border-black/5 bg-white p-8 shadow-sm transition hover:shadow-md">
                <h3 className="mb-6 text-2xl font-bold text-black">Add Webhook Endpoint</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-black/60 uppercase tracking-wider mb-2">Endpoint URL</label>
                    <input
                      type="url"
                      placeholder="https://api.yourdomain.com/webhooks/recurra"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="block w-full rounded-xl border border-black/10 bg-[#F5F5F5] py-3.5 px-4 text-black focus:ring-2 focus:ring-black/20 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-black/60 uppercase tracking-wider mb-3">Events to receive</label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {availableEvents.map(event => (
                        <label key={event} className="flex items-center space-x-3 rounded-2xl border border-black/5 bg-[#F5F5F5] p-4 cursor-pointer hover:border-black/20 transition">
                          <input 
                            type="checkbox" 
                            className="rounded border-black/20 text-black focus:ring-black h-4 w-4"
                            checked={selectedEvents.includes(event)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedEvents([...selectedEvents, event]);
                              else setSelectedEvents(selectedEvents.filter(ev => ev !== event));
                            }}
                          />
                          <span className="text-sm font-medium text-black/80">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-4 pt-6 border-t border-black/5">
                    <button onClick={() => setShowAddModal(false)} className="rounded-xl px-5 py-2.5 font-semibold text-black/60 hover:bg-black/5 transition">Cancel</button>
                    <button onClick={handleAddEndpoint} className="rounded-xl bg-black px-6 py-2.5 font-semibold text-white hover:bg-black/80 transition">Save Endpoint</button>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-black/30"></div>
            </div>
          ) : endpoints.length === 0 ? (
            <FadeIn>
              <div className="rounded-3xl border border-black/5 bg-white p-12 text-center shadow-sm">
                <Webhook className="mx-auto mb-4 h-14 w-14 text-black/15" />
                <h3 className="text-xl font-bold text-black">No endpoints configured</h3>
                <p className="mt-2 text-black/50">Add an endpoint to start receiving real-time events.</p>
              </div>
            </FadeIn>
          ) : (
            <StaggerContainer className="space-y-4">
              {endpoints.map((endpoint) => (
                <StaggerItem key={endpoint.id}>
                  <div className="flex flex-col justify-between space-y-4 rounded-3xl border border-black/5 bg-white p-8 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:space-y-0">
                    <div>
                      <div className="flex items-center space-x-3 mb-2 flex-wrap gap-y-2">
                        <h3 className="text-lg font-bold text-black break-all">{endpoint.url}</h3>
                        <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${endpoint.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {endpoint.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {endpoint.events.map(event => (
                          <span key={event} className="inline-flex rounded-lg border border-black/5 bg-[#F5F5F5] px-2.5 py-1 text-xs font-semibold text-black/60">
                            {event}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 text-xs font-medium text-black/40 flex items-center">
                        <Clock className="mr-1.5 h-3.5 w-3.5" />
                        Added on {new Date(endpoint.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button onClick={() => handleTest(endpoint.id)} className="flex items-center rounded-xl bg-[#F5F5F5] border border-black/5 px-4 py-2 font-semibold text-black/70 hover:bg-black/5 transition">
                        <RefreshCw className="mr-2 h-4 w-4" /> Test Ping
                      </button>
                      <button onClick={() => handleDelete(endpoint.id)} className="flex items-center rounded-xl bg-red-50 border border-red-100 px-4 py-2 font-semibold text-red-600 hover:bg-red-100 transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </section>
      </main>
    </PageWrapper>
  );
};

export default WebhookManager;
