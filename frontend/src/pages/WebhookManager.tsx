import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Webhook, Plus, Trash2, RefreshCw, Clock } from 'lucide-react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

const WebhookManager: React.FC = () => {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['payment.executed']);

  const availableEvents = [
    'subscription.created',
    'subscription.cancelled',
    'subscription.expired',
    'payment.executed',
    'payment.failed'
  ];

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const res = await api('/webhooks');
      if (!res.ok) throw new Error(res.error || 'Failed to fetch');
      setEndpoints(res.data.data);
    } catch (error: any) {
      console.error('Failed to fetch webhooks', error);
      toast.error(error.message || 'Failed to load webhook endpoints');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEndpoint = async () => {
    if (!newUrl) return toast.error('URL is required');
    try {
      const res = await api('/webhooks', { method: 'POST', body: JSON.stringify({ url: newUrl, events: selectedEvents }) });
      if (!res.ok) throw new Error(res.error || 'Failed to create webhook');
      toast.success('Webhook endpoint created successfully');
      setEndpoints([res.data.webhook, ...endpoints]);
      setShowAddModal(false);
      setNewUrl('');
      
      // Usually, you should show the signing secret to the user here once
      alert(`IMPORTANT: Please save your Webhook Signing Secret now. It will not be shown again.\n\nSecret: ${res.data.webhook.signingSecret}`);
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
    <div className="pt-nav min-h-screen bg-gray-950 px-4 pb-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-white">Webhook Integration</h1>
            <p className="mt-1 text-gray-400">Receive real-time events about your subscriptions and payments</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Endpoint
          </button>
        </div>

        {showAddModal && (
          <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-medium text-white">Add Webhook Endpoint</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400">Endpoint URL</label>
                <input
                  type="url"
                  placeholder="https://api.yourdomain.com/webhooks/recurra"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="mt-1 block w-full rounded-md border-0 bg-gray-800 py-2.5 px-3 text-white ring-1 ring-inset ring-gray-700 focus:ring-2 focus:ring-inset focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Events to receive</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {availableEvents.map(event => (
                    <label key={event} className="flex items-center space-x-2 rounded-lg border border-gray-800 bg-gray-950 p-3">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-600 focus:ring-offset-gray-950"
                        checked={selectedEvents.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEvents([...selectedEvents, event]);
                          } else {
                            setSelectedEvents(selectedEvents.filter(ev => ev !== event));
                          }
                        }}
                      />
                      <span className="text-sm text-gray-300">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-800">
                <button onClick={() => setShowAddModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white">Cancel</button>
                <button onClick={handleAddEndpoint} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">Save Endpoint</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
          </div>
        ) : endpoints.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 border-dashed bg-gray-900/30 p-12 text-center">
            <Webhook className="mx-auto mb-4 h-12 w-12 text-gray-500" />
            <h3 className="text-lg font-medium text-white">No endpoints configured</h3>
            <p className="mt-1 text-gray-400">Add an endpoint to start receiving real-time events.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {endpoints.map((endpoint) => (
              <motion.div 
                key={endpoint.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col justify-between space-y-4 rounded-xl border border-gray-800 bg-gray-900/50 p-6 sm:flex-row sm:items-center sm:space-y-0"
              >
                <div>
                  <div className="flex items-center space-x-3">
                    <h3 className="font-medium text-white">{endpoint.url}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${endpoint.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {endpoint.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {endpoint.events.map(event => (
                      <span key={event} className="inline-flex rounded-md bg-gray-800 px-2 py-1 text-xs font-medium text-gray-300">
                        {event}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex items-center">
                    <Clock className="mr-1 h-3 w-3" />
                    Added on {new Date(endpoint.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={() => handleTest(endpoint.id)} className="flex items-center rounded-lg border border-gray-700 bg-transparent px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-800">
                    <RefreshCw className="mr-2 h-4 w-4" /> Test Ping
                  </button>
                  <button onClick={() => handleDelete(endpoint.id)} className="flex items-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebhookManager;
