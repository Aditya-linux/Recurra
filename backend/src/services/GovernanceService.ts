import { dbPool } from '../database/index.js';


export interface CreateProposalDTO {
  proposalId: number; // On-chain ID
  proposer: string;
  targetContract: string;
  functionName: string;
  callArgs: any[];
  title: string;
  description?: string;
}

export class GovernanceService {
  /**
   * Create a new proposal in the database (off-chain metadata + on-chain link)
   */
  static async createProposal(data: CreateProposalDTO) {
    const client = await dbPool.connect();
    try {
      const result = await client.query(
        `INSERT INTO governance_proposals 
         (proposal_id, proposer, target_contract, function_name, call_args, title, description, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING *`,
        [
          data.proposalId,
          data.proposer,
          data.targetContract,
          data.functionName,
          JSON.stringify(data.callArgs),
          data.title,
          data.description,
        ]
      );
      
      // Auto-vote for the proposer
      await client.query(
        `INSERT INTO governance_votes (proposal_id, voter) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [data.proposalId, data.proposer]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Get all active and past proposals
   */
  static async getProposals() {
    const result = await dbPool.query(`
      SELECT p.*, 
             COALESCE(
               (SELECT json_agg(voter) FROM governance_votes v WHERE v.proposal_id = p.proposal_id),
               '[]'::json
             ) as approvals
      FROM governance_proposals p
      ORDER BY p.created_at DESC
    `);
    return result.rows;
  }

  /**
   * Record an off-chain vote/approval for a proposal
   */
  static async recordApproval(proposalId: number, voter: string) {
    const client = await dbPool.connect();
    try {
      await client.query(
        `INSERT INTO governance_votes (proposal_id, voter) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [proposalId, voter]
      );
      return { success: true };
    } finally {
      client.release();
    }
  }

  /**
   * Mark a proposal as executed
   */
  static async markExecuted(proposalId: number) {
    const client = await dbPool.connect();
    try {
      await client.query(
        `UPDATE governance_proposals 
         SET status = 'executed', executed_at = NOW() 
         WHERE proposal_id = $1`,
        [proposalId]
      );
      return { success: true };
    } finally {
      client.release();
    }
  }
}
