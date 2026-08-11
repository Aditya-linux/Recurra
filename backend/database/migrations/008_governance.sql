-- Migration: 008_governance.sql
-- Description: Create tables for multi-sig governance proposals and votes

CREATE TABLE IF NOT EXISTS governance_proposals (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER NOT NULL UNIQUE, -- On-chain proposal ID
    proposer VARCHAR(56) NOT NULL,
    target_contract VARCHAR(56) NOT NULL,
    function_name VARCHAR(100) NOT NULL,
    call_args JSONB NOT NULL DEFAULT '[]',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, executed, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS governance_votes (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES governance_proposals(proposal_id) ON DELETE CASCADE,
    voter VARCHAR(56) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id, voter)
);

CREATE INDEX IF NOT EXISTS idx_governance_proposals_status ON governance_proposals(status);
