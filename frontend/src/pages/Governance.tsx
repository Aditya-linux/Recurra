import React, { useState, useEffect } from 'react';

import { Shield, CheckCircle, Search, ExternalLink, Plus } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import CreateProposalModal from '../components/CreateProposalModal';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem } from '../components/ui/animations';

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
  const THRESHOLD = 2;

  const fetchProposals = async () => {
    try {
      const res = await api('/governance/proposals', { public: true });
      if (res.ok && res.data?.proposals) {
        setProposals(res.data.proposals);
      }
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProposals(); }, []);

  const handleVote = async (proposalId: number) => {
    if (!walletAddress) { toast.error('Connect your wallet first.'); return; }
    try {
      const res = await api(`/governance/proposals/${proposalId}/vote`, { method: 'POST' });
      if (!res.ok) throw new Error(res.error || 'Vote failed');
      toast.success('Vote submitted successfully');
      fetchProposals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit vote.');
    }
  };

  const handleExecute = async (proposalId: number) => {
    if (!walletAddress) { toast.error('Connect your wallet first.'); return; }
    try {
      const res = await api(`/governance/proposals/${proposalId}/execute`, { method: 'POST' });
      if (!res.ok) throw new Error(res.error || 'Execution failed');
      toast.success('Proposal executed on-chain');
      fetchProposals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to execute proposal.');
    }
  };

  const filteredProposals = proposals.filter(p =>
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.target_contract?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageWrapper>
      <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
        <section className="container mx-auto px-6 mt-10 max-w-6xl">
          <FadeIn delay={0.1}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>
                  Protocol Governance
                </h2>
                <p className="text-lg text-black/60 mt-2">
                  Multi-signature contract administration and protocol upgrades.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-black px-6 py-3 font-semibold text-white hover:bg-black/80 transition-colors self-start sm:self-auto"
              >
                <Plus className="h-5 w-5" />
                Create Proposal
              </button>
            </div>
          </FadeIn>

          {/* Search */}
          <FadeIn delay={0.2}>
            <div className="bg-white border border-black/5 shadow-sm rounded-2xl px-5 py-3.5 flex items-center mb-8 transition-shadow hover:shadow-md">
              <Search className="h-5 w-5 text-black/30 mr-3 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search proposals by title or contract address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent text-black outline-none placeholder-black/30 text-[15px]"
              />
            </div>
          </FadeIn>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-black/30"></div>
            </div>
          ) : filteredProposals.length === 0 ? (
            <FadeIn>
              <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-12 text-center">
                <Shield className="mx-auto mb-4 h-14 w-14 text-black/15" />
                <h3 className="text-xl font-bold text-black">No active proposals</h3>
                <p className="mt-2 text-black/50">There are currently no governance proposals to display.</p>
                <p className="mt-1 text-sm text-black/30">Create the first proposal to get started.</p>
              </div>
            </FadeIn>
          ) : (
            <StaggerContainer className="grid gap-6">
              {filteredProposals.map((proposal) => {
                const hasVoted = proposal.approvals?.includes(walletAddress || '');
                const canExecute = proposal.status === 'active' && (proposal.approvals?.length || 0) >= THRESHOLD;

                return (
                  <StaggerItem key={proposal.proposal_id}>
                    <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-8 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h3 className="text-xl font-bold text-black">{proposal.title}</h3>
                            <span className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              proposal.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                              proposal.status === 'executed' ? 'bg-purple-50 text-purple-600' :
                              'bg-black/5 text-black/40'
                            }`}>
                              {proposal.status}
                            </span>
                          </div>
                          <p className="text-sm text-black/40">
                            ID: {proposal.proposal_id} • Proposed by {proposal.proposer?.slice(0, 6)}...{proposal.proposer?.slice(-4)}
                          </p>
                        </div>
                      </div>

                      <p className="text-black/60 mb-6 leading-relaxed">{proposal.description}</p>

                      <div className="rounded-2xl bg-[#F5F5F5] border border-black/5 p-4 mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-black/40 block mb-1 text-xs font-bold uppercase tracking-wider">Target Contract</span>
                            <code className="bg-white px-2.5 py-1 rounded-lg text-black/70 text-xs border border-black/5">{proposal.target_contract?.slice(0, 10)}...{proposal.target_contract?.slice(-4)}</code>
                          </div>
                          <div>
                            <span className="text-black/40 block mb-1 text-xs font-bold uppercase tracking-wider">Function</span>
                            <code className="bg-white px-2.5 py-1 rounded-lg text-black/70 text-xs border border-black/5">{proposal.function_name}</code>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-black/5 pt-5 gap-4">
                        <div className="flex-1 w-full sm:w-auto sm:mr-8">
                          <div className="flex items-center justify-between mb-1.5 text-sm">
                            <span className="text-black/50 font-medium">Approval Progress</span>
                            <span className="text-black font-bold">{proposal.approvals?.length || 0} / {THRESHOLD}</span>
                          </div>
                          <div className="w-full bg-black/5 rounded-full h-2">
                            <div
                              className="bg-black h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(((proposal.approvals?.length || 0) / THRESHOLD) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="flex gap-3 flex-wrap">
                          {proposal.status === 'active' && !canExecute && (
                            <button
                              onClick={() => handleVote(proposal.proposal_id)}
                              disabled={hasVoted}
                              className={`px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors text-sm ${
                                hasVoted
                                  ? 'bg-black/5 text-black/30 cursor-not-allowed'
                                  : 'bg-black text-white hover:bg-black/80'
                              }`}
                            >
                              {hasVoted ? <CheckCircle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                              {hasVoted ? 'Approved' : 'Approve'}
                            </button>
                          )}
                          {canExecute && (
                            <button
                              onClick={() => handleExecute(proposal.proposal_id)}
                              className="px-5 py-2.5 rounded-xl font-semibold bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-2 transition-colors text-sm"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Execute On-Chain
                            </button>
                          )}
                          {proposal.status === 'executed' && (
                            <div className="px-5 py-2.5 rounded-xl font-semibold bg-black/5 text-black/40 flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4" />
                              Executed
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          )}

          {isModalOpen && (
            <CreateProposalModal
              onClose={() => setIsModalOpen(false)}
              onSuccess={() => { setIsModalOpen(false); fetchProposals(); }}
            />
          )}
        </section>
      </main>
    </PageWrapper>
  );
};

export default Governance;
