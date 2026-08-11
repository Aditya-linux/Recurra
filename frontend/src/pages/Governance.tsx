import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, Search, ExternalLink } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import CreateProposalModal from '../components/CreateProposalModal';
import { api } from '../utils/api';

interface Proposal {
  proposal_id: number;
  proposer: string;
  target_contract: string;
  function_name: string;
  title: string;
  description: string;
  status: 'active' | 'executed' | 'expired';
  created_at: string;
  approvals: string[];
}

const Governance: React.FC = () => {
  const { walletAddress } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // For demo: assume threshold is 2
  const THRESHOLD = 2;

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      const res = await api('/governance/proposals');
      if (res.ok) {
        setProposals(res.data.proposals);
      }
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalId: number) => {
    if (!walletAddress) {
      alert('Please connect your wallet first.');
      return;
    }
    try {
      await api(`/governance/proposals/${proposalId}/vote`, { method: 'POST' });
      fetchProposals(); // Refresh to get updated approvals
    } catch (err) {
      console.error('Failed to vote:', err);
      alert('Failed to submit vote.');
    }
  };

  const handleExecute = async (proposalId: number) => {
    if (!walletAddress) {
      alert('Please connect your wallet first.');
      return;
    }
    try {
      await api(`/governance/proposals/${proposalId}/execute`, { method: 'POST' });
      fetchProposals();
    } catch (err) {
      console.error('Failed to execute:', err);
      alert('Failed to execute proposal.');
    }
  };

  const filteredProposals = proposals.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.target_contract.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-indigo-600" />
            Protocol Governance
          </h1>
          <p className="text-gray-600 mt-2">
            Multi-signature contract administration and protocol upgrades.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Create Proposal
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-8 flex items-center">
        <Search className="w-5 h-5 text-gray-400 mr-3" />
        <input
          type="text"
          placeholder="Search proposals by title or contract address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 outline-none text-gray-700"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No active proposals</h3>
          <p className="text-gray-500 mt-1">There are currently no governance proposals to display.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredProposals.map((proposal) => {
            const hasVoted = proposal.approvals.includes(walletAddress || '');
            const canExecute = proposal.status === 'active' && proposal.approvals.length >= THRESHOLD;
            
            return (
              <div key={proposal.proposal_id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-gray-900">{proposal.title}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        proposal.status === 'active' ? 'bg-green-100 text-green-800' :
                        proposal.status === 'executed' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {proposal.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      ID: {proposal.proposal_id} • Proposed by {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
                    </p>
                  </div>
                </div>

                <p className="text-gray-700 mb-6">{proposal.description}</p>

                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 block mb-1">Target Contract</span>
                      <code className="bg-gray-200 px-2 py-1 rounded text-gray-800">{proposal.target_contract.slice(0, 8)}...{proposal.target_contract.slice(-4)}</code>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">Function</span>
                      <code className="bg-gray-200 px-2 py-1 rounded text-gray-800">{proposal.function_name}</code>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="text-gray-600 font-medium">Approval Progress</span>
                      <span className="text-gray-900 font-bold">{proposal.approvals.length} / {THRESHOLD}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full transition-all" 
                        style={{ width: `${Math.min((proposal.approvals.length / THRESHOLD) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="ml-8 flex gap-3">
                    {proposal.status === 'active' && !canExecute && (
                      <button
                        onClick={() => handleVote(proposal.proposal_id)}
                        disabled={hasVoted}
                        className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
                          hasVoted 
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        {hasVoted ? <CheckCircle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        {hasVoted ? 'Approved' : 'Approve'}
                      </button>
                    )}
                    
                    {canExecute && (
                      <button
                        onClick={() => handleExecute(proposal.proposal_id)}
                        className="px-6 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Execute On-Chain
                      </button>
                    )}

                    {proposal.status === 'executed' && (
                      <div className="px-6 py-2 rounded-lg font-medium bg-gray-100 text-gray-500 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Executed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <CreateProposalModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            fetchProposals();
          }} 
        />
      )}
    </div>
  );
};

export default Governance;
