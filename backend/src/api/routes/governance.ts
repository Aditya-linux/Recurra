import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { GovernanceService } from '../../services/GovernanceService.js';
import { logger } from '../../utils/logger.js';

export const governanceRoutes = Router();

/**
 * GET /api/v1/governance/proposals
 * Get all governance proposals
 */
governanceRoutes.get('/proposals', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const proposals = await GovernanceService.getProposals();
    res.json({ proposals });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/governance/proposals
 * Create a new proposal metadata record
 */
governanceRoutes.post('/proposals', authenticate, async (req: Request, res: Response) => {
  try {
    const { proposalId, targetContract, functionName, callArgs, title, description } = req.body;
    
    // req.user is populated by authenticate middleware
    const proposer = (req as any).user?.walletAddress as string;
    if (!proposer) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const proposal = await GovernanceService.createProposal({
      proposalId: Number(proposalId),
      proposer,
      targetContract,
      functionName,
      callArgs: callArgs || [],
      title,
      description
    });

    logger.info(`Governance proposal metadata created`, { proposalId, proposer });
    res.json({ proposal });
  } catch (err: any) {
    logger.error('Failed to create proposal metadata', { error: err.message });
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

/**
 * POST /api/v1/governance/proposals/:id/vote
 * Record an off-chain vote (approval) for UI display
 * Note: The actual execution requires the on-chain approval tx, 
 * this just tracks it for the dashboard.
 */
governanceRoutes.post('/proposals/:id/vote', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const proposalId = parseInt(req.params.id as string);
    const voter = (req as any).user?.walletAddress as string;
    if (!voter) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await GovernanceService.recordApproval(proposalId, voter);
    
    logger.info(`Proposal vote recorded`, { proposalId, voter });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/governance/proposals/:id/execute
 * Mark a proposal as executed
 */
governanceRoutes.post('/proposals/:id/execute', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const proposalId = parseInt(req.params.id as string);
    await GovernanceService.markExecuted(proposalId);
    
    logger.info(`Proposal marked as executed`, { proposalId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
