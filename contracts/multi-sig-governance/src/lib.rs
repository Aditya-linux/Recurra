#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, log, Address, Env, Symbol, Vec, Val,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GovernanceError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    ProposalNotFound = 4,
    AlreadyExecuted = 5,
    BelowThreshold = 6,
    AlreadyApproved = 7,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub target: Address,
    pub function_name: Symbol,
    pub call_args: Vec<Val>,
    pub created_at: u64,
    pub executed: bool,
}

#[contracttype]
pub enum DataKey {
    Signers,       // Vec<Address>
    Threshold,     // u32
    ProposalCount, // u64
    Proposal(u64), // Proposal
    Approvals(u64), // Vec<Address>
}

#[contract]
pub struct MultiSigGovernance;

#[contractimpl]
impl MultiSigGovernance {
    /// Initialize the governance contract with signers and threshold.
    pub fn initialize(
        env: Env,
        signers: Vec<Address>,
        threshold: u32,
    ) -> Result<(), GovernanceError> {
        if env.storage().instance().has(&DataKey::Signers) {
            return Err(GovernanceError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);

        log!(&env, "Governance initialized");
        Ok(())
    }

    /// Create a new proposal
    pub fn propose(
        env: Env,
        proposer: Address,
        target: Address,
        function_name: Symbol,
        call_args: Vec<Val>,
    ) -> Result<u64, GovernanceError> {
        proposer.require_auth();

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .ok_or(GovernanceError::NotInitialized)?;

        if !signers.contains(&proposer) {
            return Err(GovernanceError::Unauthorized);
        }

        let mut count: u64 = env.storage().instance().get(&DataKey::ProposalCount).unwrap();
        count += 1;
        env.storage().instance().set(&DataKey::ProposalCount, &count);

        let proposal = Proposal {
            id: count,
            proposer: proposer.clone(),
            target,
            function_name,
            call_args,
            created_at: env.ledger().timestamp(),
            executed: false,
        };

        env.storage().persistent().set(&DataKey::Proposal(count), &proposal);
        env.storage().persistent().set(&DataKey::Approvals(count), &Vec::<Address>::new(&env));

        log!(&env, "Proposal created: id={}", count);

        // Auto-approve for the proposer
        Self::approve(env, proposer, count)?;

        Ok(count)
    }

    /// Approve a proposal
    pub fn approve(env: Env, signer: Address, proposal_id: u64) -> Result<(), GovernanceError> {
        signer.require_auth();

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .ok_or(GovernanceError::NotInitialized)?;

        if !signers.contains(&signer) {
            return Err(GovernanceError::Unauthorized);
        }

        let proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(GovernanceError::ProposalNotFound)?;

        if proposal.executed {
            return Err(GovernanceError::AlreadyExecuted);
        }

        let mut approvals: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Approvals(proposal_id))
            .unwrap_or(Vec::new(&env));

        if approvals.contains(&signer) {
            return Err(GovernanceError::AlreadyApproved);
        }

        approvals.push_back(signer);
        env.storage().persistent().set(&DataKey::Approvals(proposal_id), &approvals);

        log!(&env, "Proposal {} approved", proposal_id);
        Ok(())
    }

    /// Execute a proposal
    pub fn execute(env: Env, proposal_id: u64) -> Result<Val, GovernanceError> {
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(GovernanceError::ProposalNotFound)?;

        if proposal.executed {
            return Err(GovernanceError::AlreadyExecuted);
        }

        let approvals: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Approvals(proposal_id))
            .unwrap_or(Vec::new(&env));

        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .ok_or(GovernanceError::NotInitialized)?;

        if approvals.len() < threshold {
            return Err(GovernanceError::BelowThreshold);
        }

        proposal.executed = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        // Invoke the target contract
        let result: Val = env.invoke_contract(
            &proposal.target,
            &proposal.function_name,
            proposal.call_args.clone(),
        );

        log!(&env, "Proposal {} executed", proposal_id);
        Ok(result)
    }

    // View functions
    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage().persistent().get(&DataKey::Proposal(proposal_id))
    }

    pub fn get_approvals(env: Env, proposal_id: u64) -> Option<Vec<Address>> {
        env.storage().persistent().get(&DataKey::Approvals(proposal_id))
    }
}
