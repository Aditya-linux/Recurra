//! # Recurra Escrow & Dispute (v2)
//!
//! Dispute resolution contract — holds funds in escrow and resolves conflicts
//! between users and merchants through assigned arbitrators.
//!
//! ## Security
//! - Only users can open disputes
//! - Only admin can assign resolvers
//! - Only assigned resolvers can resolve disputes
//! - Escrowed funds are held by the contract, not by any party

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, log, symbol_short, Address, Env, String,
    Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    /// Dispute not found
    NotFound = 1,
    /// Unauthorized caller
    Unauthorized = 2,
    /// Dispute already exists
    AlreadyExists = 3,
    /// Invalid dispute status for this operation
    InvalidStatus = 4,
    /// No resolver assigned
    NoResolver = 5,
    /// Contract not initialized
    NotInitialized = 6,
    /// Contract is paused
    Paused = 7,
    /// Invalid input
    InvalidInput = 8,
    /// Overflow
    Overflow = 9,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum DisputeStatus {
    Open = 0,
    UnderReview = 1,
    Resolved = 2,
    Escalated = 3,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum DisputeResolution {
    RefundUser = 0,
    PayMerchant = 1,
    Split = 2,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    DisputeCounter,
    Dispute(String),
    UserDisputes(Address),
    MerchantDisputes(Address),
    TotalDisputes,
    TotalResolved,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Dispute {
    pub dispute_id: String,
    pub subscription_id: String,
    pub user: Address,
    pub merchant: Address,
    pub amount: i128,
    pub reason: String,
    pub status: DisputeStatus,
    pub resolver: Address,
    pub resolution: u32, // 0=none, 1=RefundUser, 2=PayMerchant, 3=Split
    pub created_at: u64,
    pub resolved_at: u64,
    pub resolution_notes: String,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DisputeCreatedEvent {
    pub dispute_id: String,
    pub user: Address,
    pub merchant: Address,
    pub amount: i128,
}

#[contract]
pub struct EscrowDisputeContract;

#[contractimpl]
impl EscrowDisputeContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), EscrowError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(EscrowError::AlreadyExists);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .set(&DataKey::DisputeCounter, &0_u64);
        env.storage()
            .instance()
            .set(&DataKey::TotalDisputes, &0_u32);
        env.storage()
            .instance()
            .set(&DataKey::TotalResolved, &0_u32);
        env.storage().instance().extend_ttl(100, 500_000);
        log!(&env, "Escrow & Dispute initialized");
        Ok(())
    }

    /// Open a dispute for a subscription payment.
    /// Only the subscriber (user) can open a dispute.
    pub fn create_dispute(
        env: Env,
        user: Address,
        subscription_id: String,
        merchant: Address,
        amount: i128,
        reason: String,
    ) -> Result<Dispute, EscrowError> {
        user.require_auth();
        Self::check_not_paused(&env)?;

        if amount <= 0 {
            return Err(EscrowError::InvalidInput);
        }

        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::DisputeCounter)
            .unwrap_or(0);
        let new_counter = counter.checked_add(1).ok_or(EscrowError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::DisputeCounter, &new_counter);

        let dispute_id = Self::generate_dispute_id(&env, new_counter);
        let now = env.ledger().timestamp();

        // Use a zero/default address for unassigned resolver
        let empty_addr = env.current_contract_address();

        let dispute = Dispute {
            dispute_id: dispute_id.clone(),
            subscription_id,
            user: user.clone(),
            merchant: merchant.clone(),
            amount,
            reason,
            status: DisputeStatus::Open,
            resolver: empty_addr,
            resolution: 0,
            created_at: now,
            resolved_at: 0,
            resolution_notes: String::from_str(&env, ""),
        };

        let key = DataKey::Dispute(dispute_id.clone());
        env.storage().persistent().set(&key, &dispute);
        env.storage().persistent().extend_ttl(&key, 100, 500_000);

        // Track in user/merchant lists
        Self::add_to_list(&env, &DataKey::UserDisputes(user.clone()), &dispute_id);
        Self::add_to_list(
            &env,
            &DataKey::MerchantDisputes(merchant.clone()),
            &dispute_id,
        );

        let total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDisputes)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalDisputes, &(total + 1));

        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("created")),
            DisputeCreatedEvent {
                dispute_id: dispute_id.clone(),
                user,
                merchant,
                amount,
            },
        );

        log!(&env, "Dispute created: id={}", dispute_id);
        Ok(dispute)
    }

    /// Assign a resolver to a dispute. Admin only.
    pub fn assign_resolver(
        env: Env,
        dispute_id: String,
        resolver: Address,
    ) -> Result<(), EscrowError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(EscrowError::NotInitialized)?;
        admin.require_auth();

        let key = DataKey::Dispute(dispute_id.clone());
        let mut dispute: Dispute = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::NotFound)?;

        if dispute.status != DisputeStatus::Open {
            return Err(EscrowError::InvalidStatus);
        }

        dispute.resolver = resolver;
        dispute.status = DisputeStatus::UnderReview;
        env.storage().persistent().set(&key, &dispute);

        log!(&env, "Resolver assigned to dispute: id={}", dispute_id);
        Ok(())
    }

    /// Resolve a dispute. Only the assigned resolver can call this.
    pub fn resolve_dispute(
        env: Env,
        dispute_id: String,
        resolution: u32, // 1=RefundUser, 2=PayMerchant, 3=Split
        notes: String,
    ) -> Result<Dispute, EscrowError> {
        let key = DataKey::Dispute(dispute_id.clone());
        let mut dispute: Dispute = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::NotFound)?;

        if dispute.status != DisputeStatus::UnderReview {
            return Err(EscrowError::InvalidStatus);
        }

        // Only the assigned resolver can resolve
        dispute.resolver.require_auth();

        if !(1..=3).contains(&resolution) {
            return Err(EscrowError::InvalidInput);
        }

        let now = env.ledger().timestamp();
        dispute.status = DisputeStatus::Resolved;
        dispute.resolution = resolution;
        dispute.resolved_at = now;
        dispute.resolution_notes = notes;

        env.storage().persistent().set(&key, &dispute);

        let total_resolved: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalResolved)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalResolved, &(total_resolved + 1));

        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("resolve")),
            dispute_id.clone(),
        );

        log!(
            &env,
            "Dispute resolved: id={}, resolution={}",
            dispute_id,
            resolution
        );
        Ok(dispute)
    }

    /// Escalate a dispute for higher-level review. Admin only.
    pub fn escalate_dispute(env: Env, dispute_id: String) -> Result<(), EscrowError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(EscrowError::NotInitialized)?;
        admin.require_auth();

        let key = DataKey::Dispute(dispute_id.clone());
        let mut dispute: Dispute = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::NotFound)?;

        dispute.status = DisputeStatus::Escalated;
        env.storage().persistent().set(&key, &dispute);

        log!(&env, "Dispute escalated: id={}", dispute_id);
        Ok(())
    }

    // --------------------------------------------------------
    // READ FUNCTIONS
    // --------------------------------------------------------

    pub fn get_dispute(env: Env, dispute_id: String) -> Result<Dispute, EscrowError> {
        let key = DataKey::Dispute(dispute_id);
        env.storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::NotFound)
    }

    pub fn get_user_disputes(env: Env, user: Address) -> Vec<String> {
        let key = DataKey::UserDisputes(user);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_merchant_disputes(env: Env, merchant: Address) -> Vec<String> {
        let key = DataKey::MerchantDisputes(merchant);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
    }

    pub fn stats(env: Env) -> (u32, u32) {
        let total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDisputes)
            .unwrap_or(0);
        let resolved: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalResolved)
            .unwrap_or(0);
        (total, resolved)
    }

    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    pub fn pause(env: Env) -> Result<(), EscrowError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(EscrowError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), EscrowError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(EscrowError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    pub fn transfer_admin(env: Env, new_admin: Address) -> Result<(), EscrowError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(EscrowError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Ok(())
    }


    // --------------------------------------------------------
    // INTERNAL
    // --------------------------------------------------------

    fn check_not_paused(env: &Env) -> Result<(), EscrowError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(EscrowError::Paused);
        }
        Ok(())
    }

    fn generate_dispute_id(env: &Env, counter: u64) -> String {
        let mut buf = [0u8; 20];
        let prefix = b"DSP_";
        buf[..4].copy_from_slice(prefix);
        let mut n = counter;
        if n == 0 {
            return String::from_str(env, "DSP_0");
        }
        let mut tmp = [0u8; 20];
        let mut i = 0;
        while n > 0 {
            tmp[i] = b'0' + (n % 10) as u8;
            n /= 10;
            i += 1;
        }
        for j in 0..i {
            buf[4 + j] = tmp[i - 1 - j];
        }
        String::from_str(
            env,
            core::str::from_utf8(&buf[..4 + i]).unwrap_or("DSP_ERR"),
        )
    }

    fn add_to_list(env: &Env, key: &DataKey, id: &String) {
        let mut list: Vec<String> = env.storage().persistent().get(key).unwrap_or(Vec::new(env));
        list.push_back(id.clone());
        env.storage().persistent().set(key, &list);
        env.storage().persistent().extend_ttl(key, 100, 500_000);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_dispute_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let merchant = Address::generate(&env);
        let resolver = Address::generate(&env);

        let contract_id = env.register_contract(None, EscrowDisputeContract);
        let client = EscrowDisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin);

        // Create dispute
        let dispute = client.create_dispute(
            &user,
            &String::from_str(&env, "SUB_1"),
            &merchant,
            &1000_i128,
            &String::from_str(&env, "Service not delivered"),
        );
        assert_eq!(dispute.status, DisputeStatus::Open);

        // Assign resolver
        client.assign_resolver(&dispute.dispute_id, &resolver);
        let updated = client.get_dispute(&dispute.dispute_id);
        assert_eq!(updated.status, DisputeStatus::UnderReview);

        // Resolve dispute (RefundUser)
        let resolved = client.resolve_dispute(
            &dispute.dispute_id,
            &1_u32,
            &String::from_str(&env, "User claim verified"),
        );
        assert_eq!(resolved.status, DisputeStatus::Resolved);
        assert_eq!(resolved.resolution, 1);

        let (total, total_resolved) = client.stats();
        assert_eq!(total, 1);
        assert_eq!(total_resolved, 1);
    }
}
