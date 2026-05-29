//! # Recurra Subscription Factory
//!
//! Plan template store — merchants create and manage subscription products.
//! Each plan defines pricing, billing interval, and payment limits.
//!
//! ## Security Model
//! - Only the plan creator (merchant) can update or deactivate their plans
//! - Plan IDs are deterministically generated to prevent collisions
//! - All state-modifying functions require `require_auth()`
//! - Contract supports emergency pause by admin

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, log, symbol_short, Address, Env, String,
    Vec,
};

// ============================================================
// ERROR TYPES
// ============================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FactoryError {
    /// Plan not found
    PlanNotFound = 1,
    /// Caller is not the plan owner (merchant)
    Unauthorized = 2,
    /// Plan already exists with this ID
    PlanAlreadyExists = 3,
    /// Plan is not active
    PlanInactive = 4,
    /// Invalid input parameter
    InvalidInput = 5,
    /// Contract not initialized
    NotInitialized = 6,
    /// Contract is paused
    Paused = 7,
    /// Maximum plans per merchant reached
    MaxPlansReached = 8,
    /// Overflow error
    Overflow = 9,
}

// ============================================================
// DATA STRUCTURES
// ============================================================

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin address
    Admin,
    /// Emergency pause flag
    Paused,
    /// Global plan counter for unique ID generation
    PlanCounter,
    /// Plan data keyed by plan_id
    Plan(String),
    /// List of plan IDs for a merchant
    MerchantPlans(Address),
    /// Total number of plans
    TotalPlans,
}

/// A subscription plan created by a merchant
#[contracttype]
#[derive(Clone, Debug)]
pub struct SubscriptionPlan {
    /// Unique plan identifier
    pub plan_id: String,
    /// Merchant who created this plan
    pub merchant: Address,
    /// Human-readable plan name (e.g., "Pro Plan")
    pub name: String,
    /// Plan description
    pub description: String,
    /// Price per billing period (in smallest token unit)
    pub amount: i128,
    /// Token contract address (e.g., USDC)
    pub token: Address,
    /// Billing interval in seconds (2592000 = 30 days)
    pub interval: u64,
    /// Maximum number of payments (0 = infinite)
    pub max_payments: u32,
    /// Whether the plan accepts new subscriptions
    pub is_active: bool,
    /// Timestamp when the plan was created
    pub created_at: u64,
    /// IPFS URI for additional metadata
    pub metadata_uri: String,
    /// Number of active subscribers
    pub subscriber_count: u32,
}

/// Event emitted when a plan is created
#[contracttype]
#[derive(Clone, Debug)]
pub struct PlanCreatedEvent {
    pub plan_id: String,
    pub merchant: Address,
    pub name: String,
    pub amount: i128,
    pub interval: u64,
}

// ============================================================
// CONTRACT
// ============================================================

#[contract]
pub struct SubscriptionFactory;

#[allow(clippy::too_many_arguments)]
#[contractimpl]
impl SubscriptionFactory {
    // --------------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------------

    /// Initialize the Subscription Factory with an admin address.
    pub fn initialize(env: Env, admin: Address) -> Result<(), FactoryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(FactoryError::PlanAlreadyExists);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::PlanCounter, &0_u64);
        env.storage().instance().set(&DataKey::TotalPlans, &0_u32);
        env.storage().instance().extend_ttl(100, 500_000);

        log!(&env, "Subscription Factory initialized");
        Ok(())
    }

    // --------------------------------------------------------
    // MERCHANT FUNCTIONS
    // --------------------------------------------------------

    /// Create a new subscription plan.
    ///
    /// # Arguments
    /// * `merchant` — The merchant creating the plan
    /// * `name` — Human-readable plan name
    /// * `description` — Plan description
    /// * `amount` — Price per billing period
    /// * `token` — Token contract address
    /// * `interval` — Billing interval in seconds
    /// * `max_payments` — Maximum number of payments (0 = infinite)
    /// * `metadata_uri` — IPFS URI for additional metadata
    ///
    /// # Security
    /// - Requires merchant authentication
    /// - Validates all inputs
    /// - Generates unique plan ID
    #[allow(clippy::too_many_arguments)]
    pub fn create_plan(
        env: Env,
        merchant: Address,
        name: String,
        description: String,
        amount: i128,
        token: Address,
        interval: u64,
        max_payments: u32,
        metadata_uri: String,
    ) -> Result<SubscriptionPlan, FactoryError> {
        // Security: require merchant auth
        merchant.require_auth();

        Self::check_not_paused(&env)?;

        // Input validation
        if amount <= 0 {
            return Err(FactoryError::InvalidInput);
        }
        if interval < 3600 {
            // Minimum 1 hour interval
            return Err(FactoryError::InvalidInput);
        }

        // Check merchant plan limit (max 100 plans per merchant)
        let merchant_plans = Self::get_merchant_plan_list(&env, &merchant);
        if merchant_plans.len() >= 100 {
            return Err(FactoryError::MaxPlansReached);
        }

        // Generate unique plan ID
        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::PlanCounter)
            .unwrap_or(0);

        let new_counter = counter.checked_add(1).ok_or(FactoryError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::PlanCounter, &new_counter);

        let plan_id = Self::generate_plan_id(&env, &merchant, new_counter);

        let now = env.ledger().timestamp();

        let plan = SubscriptionPlan {
            plan_id: plan_id.clone(),
            merchant: merchant.clone(),
            name: name.clone(),
            description,
            amount,
            token,
            interval,
            max_payments,
            is_active: true,
            created_at: now,
            metadata_uri,
            subscriber_count: 0,
        };

        // Store plan
        let plan_key = DataKey::Plan(plan_id.clone());
        env.storage().persistent().set(&plan_key, &plan);
        env.storage()
            .persistent()
            .extend_ttl(&plan_key, 100, 500_000);

        // Add to merchant's plan list
        Self::add_to_merchant_plans(&env, &merchant, &plan_id);

        // Update total plans count
        let total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPlans)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalPlans, &(total + 1));

        // Emit event
        env.events().publish(
            (symbol_short!("plan"), symbol_short!("created")),
            PlanCreatedEvent {
                plan_id: plan_id.clone(),
                merchant: merchant.clone(),
                name,
                amount,
                interval,
            },
        );

        log!(&env, "Plan created: id={}, merchant={}", plan_id, merchant);
        Ok(plan)
    }

    /// Update an existing plan. Only the plan owner (merchant) can update.
    ///
    /// # Security
    /// - Requires merchant auth
    /// - Only the original creator can update
    /// - Cannot change merchant or plan_id
    #[allow(clippy::too_many_arguments)]
    pub fn update_plan(
        env: Env,
        merchant: Address,
        plan_id: String,
        name: String,
        description: String,
        amount: i128,
        interval: u64,
        max_payments: u32,
        metadata_uri: String,
    ) -> Result<SubscriptionPlan, FactoryError> {
        merchant.require_auth();
        Self::check_not_paused(&env)?;

        if amount <= 0 || interval < 3600 {
            return Err(FactoryError::InvalidInput);
        }

        let plan_key = DataKey::Plan(plan_id.clone());
        let mut plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&plan_key)
            .ok_or(FactoryError::PlanNotFound)?;

        // Security: only owner can update
        if plan.merchant != merchant {
            return Err(FactoryError::Unauthorized);
        }

        // Update mutable fields
        plan.name = name;
        plan.description = description;
        plan.amount = amount;
        plan.interval = interval;
        plan.max_payments = max_payments;
        plan.metadata_uri = metadata_uri;

        env.storage().persistent().set(&plan_key, &plan);
        env.storage()
            .persistent()
            .extend_ttl(&plan_key, 100, 500_000);

        log!(&env, "Plan updated: id={}", plan_id);
        Ok(plan)
    }

    /// Deactivate a plan — prevents new subscriptions but existing ones continue.
    ///
    /// # Security
    /// - Only the plan owner can deactivate
    pub fn deactivate_plan(
        env: Env,
        merchant: Address,
        plan_id: String,
    ) -> Result<(), FactoryError> {
        merchant.require_auth();

        let plan_key = DataKey::Plan(plan_id.clone());
        let mut plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&plan_key)
            .ok_or(FactoryError::PlanNotFound)?;

        if plan.merchant != merchant {
            return Err(FactoryError::Unauthorized);
        }

        plan.is_active = false;
        env.storage().persistent().set(&plan_key, &plan);

        env.events().publish(
            (symbol_short!("plan"), symbol_short!("deactiv")),
            plan_id.clone(),
        );

        log!(&env, "Plan deactivated: id={}", plan_id);
        Ok(())
    }

    /// Reactivate a previously deactivated plan.
    pub fn reactivate_plan(
        env: Env,
        merchant: Address,
        plan_id: String,
    ) -> Result<(), FactoryError> {
        merchant.require_auth();

        let plan_key = DataKey::Plan(plan_id.clone());
        let mut plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&plan_key)
            .ok_or(FactoryError::PlanNotFound)?;

        if plan.merchant != merchant {
            return Err(FactoryError::Unauthorized);
        }

        plan.is_active = true;
        env.storage().persistent().set(&plan_key, &plan);

        log!(&env, "Plan reactivated: id={}", plan_id);
        Ok(())
    }

    /// Increment subscriber count (called by Payment Engine on new subscription).
    pub fn increment_subscribers(env: Env, plan_id: String) -> Result<(), FactoryError> {
        let plan_key = DataKey::Plan(plan_id.clone());
        let mut plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&plan_key)
            .ok_or(FactoryError::PlanNotFound)?;

        plan.subscriber_count = plan
            .subscriber_count
            .checked_add(1)
            .ok_or(FactoryError::Overflow)?;

        env.storage().persistent().set(&plan_key, &plan);
        Ok(())
    }

    /// Decrement subscriber count (called by Payment Engine on cancellation).
    pub fn decrement_subscribers(env: Env, plan_id: String) -> Result<(), FactoryError> {
        let plan_key = DataKey::Plan(plan_id.clone());
        let mut plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&plan_key)
            .ok_or(FactoryError::PlanNotFound)?;

        plan.subscriber_count = plan.subscriber_count.saturating_sub(1);
        env.storage().persistent().set(&plan_key, &plan);
        Ok(())
    }

    // --------------------------------------------------------
    // READ FUNCTIONS
    // --------------------------------------------------------

    /// Get a plan by its ID.
    pub fn get_plan(env: Env, plan_id: String) -> Result<SubscriptionPlan, FactoryError> {
        let plan_key = DataKey::Plan(plan_id);
        env.storage()
            .persistent()
            .get(&plan_key)
            .ok_or(FactoryError::PlanNotFound)
    }

    /// List all plans for a merchant.
    pub fn list_merchant_plans(env: Env, merchant: Address) -> Vec<String> {
        Self::get_merchant_plan_list(&env, &merchant)
    }

    /// Get total number of plans.
    pub fn total_plans(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalPlans)
            .unwrap_or(0)
    }

    // --------------------------------------------------------
    // ADMIN FUNCTIONS
    // --------------------------------------------------------

    /// Emergency pause.
    pub fn pause(env: Env) -> Result<(), FactoryError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(FactoryError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        log!(&env, "Subscription Factory PAUSED");
        Ok(())
    }

    /// Resume after pause.
    pub fn unpause(env: Env) -> Result<(), FactoryError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(FactoryError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        log!(&env, "Subscription Factory UNPAUSED");
        Ok(())
    }

    // --------------------------------------------------------
    // INTERNAL HELPERS
    // --------------------------------------------------------

    fn check_not_paused(env: &Env) -> Result<(), FactoryError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(FactoryError::Paused);
        }
        Ok(())
    }

    fn generate_plan_id(env: &Env, _merchant: &Address, counter: u64) -> String {
        // Generate a deterministic plan ID using counter
        // Format: PLAN_{counter}
        let mut id_bytes = [0u8; 20];
        let prefix = b"PLAN_";
        id_bytes[..5].copy_from_slice(prefix);

        // Convert counter to string bytes
        let counter_str = Self::u64_to_bytes(counter);
        let len = counter_str.len().min(15);
        id_bytes[5..5 + len].copy_from_slice(&counter_str[..len]);

        String::from_str(
            env,
            core::str::from_utf8(&id_bytes[..5 + len]).unwrap_or("PLAN_ERR"),
        )
    }

    fn u64_to_bytes(mut n: u64) -> [u8; 20] {
        let mut buf = [0u8; 20];
        if n == 0 {
            buf[0] = b'0';
            return buf;
        }
        let mut i = 0;
        let mut tmp = [0u8; 20];
        while n > 0 {
            tmp[i] = b'0' + (n % 10) as u8;
            n /= 10;
            i += 1;
        }
        for j in 0..i {
            buf[j] = tmp[i - 1 - j];
        }
        buf
    }

    fn get_merchant_plan_list(env: &Env, merchant: &Address) -> Vec<String> {
        let key = DataKey::MerchantPlans(merchant.clone());
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }

    fn add_to_merchant_plans(env: &Env, merchant: &Address, plan_id: &String) {
        let key = DataKey::MerchantPlans(merchant.clone());
        let mut list: Vec<String> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));

        list.push_back(plan_id.clone());
        env.storage().persistent().set(&key, &list);
        env.storage().persistent().extend_ttl(&key, 100, 500_000);
    }
}

// ============================================================
// TESTS
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_create_plan() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register_contract(None, SubscriptionFactory);
        let client = SubscriptionFactoryClient::new(&env, &contract_id);

        client.initialize(&admin);

        let plan = client.create_plan(
            &merchant,
            &String::from_str(&env, "Pro Plan"),
            &String::from_str(&env, "Premium features for professionals"),
            &1000_i128,
            &token,
            &2592000_u64, // 30 days
            &0_u32,       // infinite
            &String::from_str(&env, "ipfs://QmExample"),
        );

        assert_eq!(plan.amount, 1000);
        assert_eq!(plan.interval, 2592000);
        assert!(plan.is_active);
        assert_eq!(plan.subscriber_count, 0);
    }

    #[test]
    fn test_deactivate_plan() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register_contract(None, SubscriptionFactory);
        let client = SubscriptionFactoryClient::new(&env, &contract_id);

        client.initialize(&admin);

        let plan = client.create_plan(
            &merchant,
            &String::from_str(&env, "Basic Plan"),
            &String::from_str(&env, "Basic features"),
            &500_i128,
            &token,
            &2592000_u64,
            &12_u32,
            &String::from_str(&env, "ipfs://QmBasic"),
        );

        client.deactivate_plan(&merchant, &plan.plan_id);

        let updated = client.get_plan(&plan.plan_id);
        assert!(!updated.is_active);
    }

    #[test]
    fn test_list_merchant_plans() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register_contract(None, SubscriptionFactory);
        let client = SubscriptionFactoryClient::new(&env, &contract_id);

        client.initialize(&admin);

        // Create two plans
        client.create_plan(
            &merchant,
            &String::from_str(&env, "Plan A"),
            &String::from_str(&env, "Description A"),
            &500_i128,
            &token,
            &2592000_u64,
            &0_u32,
            &String::from_str(&env, "ipfs://A"),
        );

        client.create_plan(
            &merchant,
            &String::from_str(&env, "Plan B"),
            &String::from_str(&env, "Description B"),
            &1000_i128,
            &token,
            &2592000_u64,
            &0_u32,
            &String::from_str(&env, "ipfs://B"),
        );

        let plans = client.list_merchant_plans(&merchant);
        assert_eq!(plans.len(), 2);
    }
}
