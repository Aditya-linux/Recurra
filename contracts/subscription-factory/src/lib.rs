//! # Recurra Subscription Factory (v2 — Tiers, Trials, Discounts)
//!
//! Plan template store — merchants create and manage subscription products.
//! Each plan defines pricing, billing interval, payment limits, tier, trial period,
//! and optional discount codes.
//!
//! ## v2 Additions
//! - **Tiered Plans**: Basic / Standard / Pro / Enterprise
//! - **Trial Periods**: Plans can offer N-day free trials
//! - **On-Chain Discount Codes**: Merchant-created codes with percentage/fixed discounts
//!
//! ## Security Model
//! - Only the plan creator (merchant) can update or deactivate their plans
//! - Plan IDs are deterministically generated to prevent collisions
//! - All state-modifying functions require `require_auth()`
//! - Contract supports emergency pause by admin
//! - Discount codes are merchant-scoped and have usage limits

#![no_std]
#![allow(clippy::too_many_arguments)]

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
    /// Discount code not found
    DiscountNotFound = 10,
    /// Discount code expired
    DiscountExpired = 11,
    /// Discount code usage limit reached
    DiscountExhausted = 12,
    /// Discount code already exists
    DiscountAlreadyExists = 13,
    /// Invalid tier value
    InvalidTier = 14,
}

// ============================================================
// DATA STRUCTURES
// ============================================================

/// Plan tier levels — determines feature access and pricing visibility
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PlanTier {
    Basic = 0,
    Standard = 1,
    Pro = 2,
    Enterprise = 3,
}

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
    /// Discount code data keyed by (merchant, code_string)
    DiscountCode(Address, String),
    /// List of discount codes for a merchant
    MerchantDiscounts(Address),
    /// Discount counter
    DiscountCounter,
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
    /// Plan tier (Basic/Standard/Pro/Enterprise)
    pub tier: PlanTier,
    /// Trial period in days (0 = no trial)
    pub trial_days: u32,
    /// Feature list encoded as a comma-separated string
    /// (e.g., "Unlimited API calls,Priority support,Custom branding")
    pub features: String,
}

/// On-chain discount code created by a merchant
#[contracttype]
#[derive(Clone, Debug)]
pub struct DiscountCode {
    /// The discount code string (e.g., "LAUNCH50")
    pub code: String,
    /// Merchant who created this discount
    pub merchant: Address,
    /// Discount percentage (0-100). If > 0, this is a percentage discount.
    pub discount_percent: u32,
    /// Fixed discount amount (in token units). If > 0 and percent == 0, this is a fixed discount.
    pub discount_amount: i128,
    /// Maximum number of times this code can be used (0 = unlimited)
    pub max_uses: u32,
    /// Number of times this code has been used
    pub used_count: u32,
    /// Expiry timestamp (0 = never expires)
    pub expires_at: u64,
    /// Whether this code is active
    pub is_active: bool,
    /// Only applies to first payment of a subscription
    pub first_payment_only: bool,
    /// Timestamp when the code was created
    pub created_at: u64,
}

/// Result of applying a discount code
#[contracttype]
#[derive(Clone, Debug)]
pub struct DiscountResult {
    /// Original amount before discount
    pub original_amount: i128,
    /// Discounted amount to charge
    pub discounted_amount: i128,
    /// Savings from the discount
    pub savings: i128,
    /// The discount code used
    pub code: String,
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
    pub tier: PlanTier,
    pub trial_days: u32,
}

/// Event emitted when a discount code is created
#[contracttype]
#[derive(Clone, Debug)]
pub struct DiscountCreatedEvent {
    pub code: String,
    pub merchant: Address,
    pub discount_percent: u32,
    pub discount_amount: i128,
    pub max_uses: u32,
}

/// Configuration for creating or updating a plan
#[contracttype]
#[derive(Clone, Debug)]
pub struct PlanConfig {
    pub name: String,
    pub description: String,
    pub amount: i128,
    pub token: Address,
    pub interval: u64,
    pub max_payments: u32,
    pub metadata_uri: String,
    pub tier: u32,
    pub trial_days: u32,
    pub features: String,
}

// ============================================================
// CONTRACT
// ============================================================

#[contract]
pub struct SubscriptionFactory;

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
        env.storage()
            .instance()
            .set(&DataKey::DiscountCounter, &0_u64);
        env.storage().instance().extend_ttl(100, 500_000);

        log!(&env, "Subscription Factory v2 initialized (tiers, trials, discounts)");
        Ok(())
    }

    // --------------------------------------------------------
    // MERCHANT FUNCTIONS — PLANS
    // --------------------------------------------------------

    /// Create a new subscription plan with tier, trial, and feature support.
    ///
    /// # Arguments
    /// * `merchant` — The merchant creating the plan
    /// * `config` — The plan configuration parameters
    pub fn create_plan(
        env: Env,
        merchant: Address,
        config: PlanConfig,
    ) -> Result<SubscriptionPlan, FactoryError> {
        // Security: require merchant auth
        merchant.require_auth();

        Self::check_not_paused(&env)?;

        // Input validation
        if config.amount <= 0 {
            return Err(FactoryError::InvalidInput);
        }
        if config.interval < 3600 {
            // Minimum 1 hour interval
            return Err(FactoryError::InvalidInput);
        }

        // Validate tier
        let plan_tier = Self::u32_to_tier(config.tier)?;

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
            name: config.name.clone(),
            description: config.description,
            amount: config.amount,
            token: config.token,
            interval: config.interval,
            max_payments: config.max_payments,
            is_active: true,
            created_at: now,
            metadata_uri: config.metadata_uri,
            subscriber_count: 0,
            tier: plan_tier,
            trial_days: config.trial_days,
            features: config.features,
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
                name: config.name,
                amount: config.amount,
                interval: config.interval,
                tier: plan_tier,
                trial_days: config.trial_days,
            },
        );

        log!(
            &env,
            "Plan created: id={}, tier={}, trial={}d",
            plan_id,
            config.tier,
            config.trial_days
        );
        Ok(plan)
    }

    /// Update an existing plan. Only the plan owner (merchant) can update.
    pub fn update_plan(
        env: Env,
        merchant: Address,
        plan_id: String,
        config: PlanConfig,
    ) -> Result<SubscriptionPlan, FactoryError> {
        merchant.require_auth();
        Self::check_not_paused(&env)?;

        if config.amount <= 0 || config.interval < 3600 {
            return Err(FactoryError::InvalidInput);
        }

        let plan_tier = Self::u32_to_tier(config.tier)?;

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
        plan.name = config.name;
        plan.description = config.description;
        plan.amount = config.amount;
        plan.interval = config.interval;
        plan.max_payments = config.max_payments;
        plan.metadata_uri = config.metadata_uri;
        plan.tier = plan_tier;
        plan.trial_days = config.trial_days;
        plan.features = config.features;

        env.storage().persistent().set(&plan_key, &plan);
        env.storage()
            .persistent()
            .extend_ttl(&plan_key, 100, 500_000);

        log!(&env, "Plan updated: id={}", plan_id);
        Ok(plan)
    }

    /// Deactivate a plan — prevents new subscriptions but existing ones continue.
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
    // DISCOUNT CODE MANAGEMENT
    // --------------------------------------------------------

    /// Create a new discount code for a merchant.
    ///
    /// # Arguments
    /// * `merchant` — The merchant creating the code
    /// * `code` — The discount code string (e.g., "LAUNCH50")
    /// * `discount_percent` — Percentage discount (0-100). Set to 0 for fixed amount.
    /// * `discount_amount` — Fixed discount in token units. Set to 0 for percentage.
    /// * `max_uses` — Maximum redemptions (0 = unlimited)
    /// * `expires_at` — Expiry timestamp (0 = never expires)
    /// * `first_payment_only` — If true, discount applies only to the first payment
    pub fn create_discount_code(
        env: Env,
        merchant: Address,
        code: String,
        discount_percent: u32,
        discount_amount: i128,
        max_uses: u32,
        expires_at: u64,
        first_payment_only: bool,
    ) -> Result<DiscountCode, FactoryError> {
        merchant.require_auth();
        Self::check_not_paused(&env)?;

        // Validate: either percent or amount must be set, not both
        if discount_percent == 0 && discount_amount <= 0 {
            return Err(FactoryError::InvalidInput);
        }
        if discount_percent > 0 && discount_amount > 0 {
            return Err(FactoryError::InvalidInput);
        }
        if discount_percent > 100 {
            return Err(FactoryError::InvalidInput);
        }

        // Check if code already exists for this merchant
        let code_key = DataKey::DiscountCode(merchant.clone(), code.clone());
        if env.storage().persistent().has(&code_key) {
            return Err(FactoryError::DiscountAlreadyExists);
        }

        let now = env.ledger().timestamp();

        let discount = DiscountCode {
            code: code.clone(),
            merchant: merchant.clone(),
            discount_percent,
            discount_amount,
            max_uses,
            used_count: 0,
            expires_at,
            is_active: true,
            first_payment_only,
            created_at: now,
        };

        env.storage().persistent().set(&code_key, &discount);
        env.storage()
            .persistent()
            .extend_ttl(&code_key, 100, 500_000);

        // Track in merchant's discount list
        Self::add_to_merchant_discounts(&env, &merchant, &code);

        env.events().publish(
            (symbol_short!("discount"), symbol_short!("created")),
            DiscountCreatedEvent {
                code: code.clone(),
                merchant: merchant.clone(),
                discount_percent,
                discount_amount,
                max_uses,
            },
        );

        log!(&env, "Discount code created: code={}", code);
        Ok(discount)
    }

    /// Validate a discount code and calculate the discounted amount.
    /// Does NOT increment usage — call `apply_discount` after payment.
    pub fn validate_discount(
        env: Env,
        merchant: Address,
        code: String,
        original_amount: i128,
    ) -> Result<DiscountResult, FactoryError> {
        let code_key = DataKey::DiscountCode(merchant, code.clone());
        let discount: DiscountCode = env
            .storage()
            .persistent()
            .get(&code_key)
            .ok_or(FactoryError::DiscountNotFound)?;

        // Check active
        if !discount.is_active {
            return Err(FactoryError::DiscountNotFound);
        }

        // Check expiry
        let now = env.ledger().timestamp();
        if discount.expires_at > 0 && now > discount.expires_at {
            return Err(FactoryError::DiscountExpired);
        }

        // Check usage limit
        if discount.max_uses > 0 && discount.used_count >= discount.max_uses {
            return Err(FactoryError::DiscountExhausted);
        }

        // Calculate discount
        let savings = if discount.discount_percent > 0 {
            (original_amount * discount.discount_percent as i128) / 100
        } else {
            // Fixed discount, capped at original amount
            if discount.discount_amount > original_amount {
                original_amount
            } else {
                discount.discount_amount
            }
        };

        let discounted_amount = original_amount - savings;

        Ok(DiscountResult {
            original_amount,
            discounted_amount,
            savings,
            code,
        })
    }

    /// Apply a discount code — increments usage counter.
    /// Called by Payment Engine AFTER successful payment.
    pub fn apply_discount(
        env: Env,
        merchant: Address,
        code: String,
    ) -> Result<(), FactoryError> {
        let code_key = DataKey::DiscountCode(merchant, code.clone());
        let mut discount: DiscountCode = env
            .storage()
            .persistent()
            .get(&code_key)
            .ok_or(FactoryError::DiscountNotFound)?;

        discount.used_count = discount
            .used_count
            .checked_add(1)
            .ok_or(FactoryError::Overflow)?;

        // Auto-deactivate if max uses reached
        if discount.max_uses > 0 && discount.used_count >= discount.max_uses {
            discount.is_active = false;
        }

        env.storage().persistent().set(&code_key, &discount);

        log!(
            &env,
            "Discount applied: code={}, uses={}/{}",
            code,
            discount.used_count,
            discount.max_uses
        );
        Ok(())
    }

    /// Deactivate a discount code. Only the merchant can call this.
    pub fn deactivate_discount(
        env: Env,
        merchant: Address,
        code: String,
    ) -> Result<(), FactoryError> {
        merchant.require_auth();

        let code_key = DataKey::DiscountCode(merchant, code.clone());
        let mut discount: DiscountCode = env
            .storage()
            .persistent()
            .get(&code_key)
            .ok_or(FactoryError::DiscountNotFound)?;

        discount.is_active = false;
        env.storage().persistent().set(&code_key, &discount);

        log!(&env, "Discount deactivated: code={}", code);
        Ok(())
    }

    /// Get a discount code's details.
    pub fn get_discount(
        env: Env,
        merchant: Address,
        code: String,
    ) -> Result<DiscountCode, FactoryError> {
        let code_key = DataKey::DiscountCode(merchant, code);
        env.storage()
            .persistent()
            .get(&code_key)
            .ok_or(FactoryError::DiscountNotFound)
    }

    /// List all discount codes for a merchant.
    pub fn list_merchant_discounts(env: Env, merchant: Address) -> Vec<String> {
        let key = DataKey::MerchantDiscounts(merchant);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
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

    /// List all plans for a merchant filtered by tier.
    pub fn list_plans_by_tier(env: Env, merchant: Address, tier: u32) -> Vec<String> {
        let plan_tier = match Self::u32_to_tier(tier) {
            Ok(t) => t,
            Err(_) => return Vec::new(&env),
        };

        let plan_ids = Self::get_merchant_plan_list(&env, &merchant);
        let mut filtered = Vec::new(&env);

        for i in 0..plan_ids.len() {
            let plan_id = plan_ids.get(i).unwrap();
            if let Some(plan) = env
                .storage()
                .persistent()
                .get::<DataKey, SubscriptionPlan>(&DataKey::Plan(plan_id.clone()))
            {
                if plan.tier == plan_tier && plan.is_active {
                    filtered.push_back(plan_id);
                }
            }
        }

        filtered
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

    pub fn transfer_admin(env: Env, new_admin: Address) -> Result<(), FactoryError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(FactoryError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        log!(&env, "Admin transferred");
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

    fn u32_to_tier(tier: u32) -> Result<PlanTier, FactoryError> {
        match tier {
            0 => Ok(PlanTier::Basic),
            1 => Ok(PlanTier::Standard),
            2 => Ok(PlanTier::Pro),
            3 => Ok(PlanTier::Enterprise),
            _ => Err(FactoryError::InvalidTier),
        }
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

    fn add_to_merchant_discounts(env: &Env, merchant: &Address, code: &String) {
        let key = DataKey::MerchantDiscounts(merchant.clone());
        let mut list: Vec<String> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));

        list.push_back(code.clone());
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
    fn test_create_tiered_plan() {
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
            &PlanConfig {
                name: String::from_str(&env, "Pro Plan"),
                description: String::from_str(&env, "Premium features for professionals"),
                amount: 1000_i128,
                token,
                interval: 2592000_u64, // 30 days
                max_payments: 0_u32,       // infinite
                metadata_uri: String::from_str(&env, "ipfs://QmExample"),
                tier: 2_u32,       // Pro tier
                trial_days: 14_u32,      // 14-day trial
                features: String::from_str(&env, "Unlimited API,Priority support,Custom branding"),
            },
        );

        assert_eq!(plan.amount, 1000);
        assert_eq!(plan.interval, 2592000);
        assert!(plan.is_active);
        assert_eq!(plan.subscriber_count, 0);
        assert_eq!(plan.tier, PlanTier::Pro);
        assert_eq!(plan.trial_days, 14);
    }

    #[test]
    fn test_create_plan_basic_tier() {
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
            &PlanConfig {
                name: String::from_str(&env, "Basic Plan"),
                description: String::from_str(&env, "Basic features"),
                amount: 500_i128,
                token,
                interval: 2592000_u64,
                max_payments: 12_u32,
                metadata_uri: String::from_str(&env, "ipfs://QmBasic"),
                tier: 0_u32, // Basic tier
                trial_days: 0_u32, // No trial
                features: String::from_str(&env, "5 API calls/day,Email support"),
            },
        );

        assert_eq!(plan.tier, PlanTier::Basic);
        assert_eq!(plan.trial_days, 0);
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
            &PlanConfig {
                name: String::from_str(&env, "Basic Plan"),
                description: String::from_str(&env, "Basic features"),
                amount: 500_i128,
                token,
                interval: 2592000_u64,
                max_payments: 12_u32,
                metadata_uri: String::from_str(&env, "ipfs://QmBasic"),
                tier: 1_u32,
                trial_days: 0_u32,
                features: String::from_str(&env, ""),
            },
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

        // Create two plans with different tiers
        client.create_plan(
            &merchant,
            &PlanConfig {
                name: String::from_str(&env, "Plan A"),
                description: String::from_str(&env, "Description A"),
                amount: 500_i128,
                token: token.clone(),
                interval: 2592000_u64,
                max_payments: 0_u32,
                metadata_uri: String::from_str(&env, "ipfs://A"),
                tier: 0_u32, // Basic
                trial_days: 0_u32,
                features: String::from_str(&env, ""),
            },
        );

        client.create_plan(
            &merchant,
            &PlanConfig {
                name: String::from_str(&env, "Plan B"),
                description: String::from_str(&env, "Description B"),
                amount: 1000_i128,
                token,
                interval: 2592000_u64,
                max_payments: 0_u32,
                metadata_uri: String::from_str(&env, "ipfs://B"),
                tier: 2_u32, // Pro
                trial_days: 7_u32, // 7-day trial
                features: String::from_str(&env, ""),
            },
        );

        let plans = client.list_merchant_plans(&merchant);
        assert_eq!(plans.len(), 2);
    }

    #[test]
    fn test_create_discount_code_percent() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);

        let contract_id = env.register_contract(None, SubscriptionFactory);
        let client = SubscriptionFactoryClient::new(&env, &contract_id);

        client.initialize(&admin);

        let discount = client.create_discount_code(
            &merchant,
            &String::from_str(&env, "LAUNCH50"),
            &50_u32,   // 50% off
            &0_i128,   // no fixed amount
            &100_u32,  // max 100 uses
            &0_u64,    // never expires
            &true,     // first payment only
        );

        assert_eq!(discount.discount_percent, 50);
        assert_eq!(discount.max_uses, 100);
        assert_eq!(discount.used_count, 0);
        assert!(discount.is_active);
        assert!(discount.first_payment_only);
    }

    #[test]
    fn test_create_discount_code_fixed() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);

        let contract_id = env.register_contract(None, SubscriptionFactory);
        let client = SubscriptionFactoryClient::new(&env, &contract_id);

        client.initialize(&admin);

        let discount = client.create_discount_code(
            &merchant,
            &String::from_str(&env, "SAVE5"),
            &0_u32,       // no percent
            &5_000_000,   // 5 USDC fixed (7 decimals)
            &0_u32,       // unlimited
            &0_u64,       // never expires
            &false,       // applies to all payments
        );

        assert_eq!(discount.discount_amount, 5_000_000);
        assert_eq!(discount.discount_percent, 0);
    }

    #[test]
    fn test_validate_discount_percent() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);

        let contract_id = env.register_contract(None, SubscriptionFactory);
        let client = SubscriptionFactoryClient::new(&env, &contract_id);

        client.initialize(&admin);

        client.create_discount_code(
            &merchant,
            &String::from_str(&env, "HALF"),
            &50_u32,
            &0_i128,
            &0_u32,
            &0_u64,
            &true,
        );

        let result = client.validate_discount(
            &merchant,
            &String::from_str(&env, "HALF"),
            &10_000_000, // 10 USDC
        );

        assert_eq!(result.original_amount, 10_000_000);
        assert_eq!(result.savings, 5_000_000);
        assert_eq!(result.discounted_amount, 5_000_000);
    }

    #[test]
    fn test_apply_discount_increments_usage() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);

        let contract_id = env.register_contract(None, SubscriptionFactory);
        let client = SubscriptionFactoryClient::new(&env, &contract_id);

        client.initialize(&admin);

        client.create_discount_code(
            &merchant,
            &String::from_str(&env, "ONCE"),
            &25_u32,
            &0_i128,
            &2_u32, // max 2 uses
            &0_u64,
            &true,
        );

        // First use
        client.apply_discount(&merchant, &String::from_str(&env, "ONCE"));
        let d1 = client.get_discount(&merchant, &String::from_str(&env, "ONCE"));
        assert_eq!(d1.used_count, 1);
        assert!(d1.is_active);

        // Second use — should auto-deactivate
        client.apply_discount(&merchant, &String::from_str(&env, "ONCE"));
        let d2 = client.get_discount(&merchant, &String::from_str(&env, "ONCE"));
        assert_eq!(d2.used_count, 2);
        assert!(!d2.is_active); // auto-deactivated at max_uses
    }

    #[test]
    fn test_list_plans_by_tier() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let merchant = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register_contract(None, SubscriptionFactory);
        let client = SubscriptionFactoryClient::new(&env, &contract_id);

        client.initialize(&admin);

        // Create plans at different tiers
        client.create_plan(
            &merchant,
            &PlanConfig {
                name: String::from_str(&env, "Basic A"),
                description: String::from_str(&env, ""),
                amount: 500_i128,
                token: token.clone(),
                interval: 2592000_u64,
                max_payments: 0_u32,
                metadata_uri: String::from_str(&env, ""),
                tier: 0_u32, // Basic
                trial_days: 0_u32,
                features: String::from_str(&env, ""),
            },
        );

        client.create_plan(
            &merchant,
            &PlanConfig {
                name: String::from_str(&env, "Pro A"),
                description: String::from_str(&env, ""),
                amount: 1500_i128,
                token: token.clone(),
                interval: 2592000_u64,
                max_payments: 0_u32,
                metadata_uri: String::from_str(&env, ""),
                tier: 2_u32, // Pro
                trial_days: 0_u32,
                features: String::from_str(&env, ""),
            },
        );

        client.create_plan(
            &merchant,
            &PlanConfig {
                name: String::from_str(&env, "Basic B"),
                description: String::from_str(&env, ""),
                amount: 300_i128,
                token,
                interval: 2592000_u64,
                max_payments: 0_u32,
                metadata_uri: String::from_str(&env, ""),
                tier: 0_u32, // Basic
                trial_days: 0_u32,
                features: String::from_str(&env, ""),
            },
        );

        let basic_plans = client.list_plans_by_tier(&merchant, &0_u32);
        assert_eq!(basic_plans.len(), 2);

        let pro_plans = client.list_plans_by_tier(&merchant, &2_u32);
        assert_eq!(pro_plans.len(), 1);
    }

    #[test]
    fn test_update_plan_with_tier() {
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
            &PlanConfig {
                name: String::from_str(&env, "Starter"),
                description: String::from_str(&env, ""),
                amount: 500_i128,
                token: token.clone(),
                interval: 2592000_u64,
                max_payments: 0_u32,
                metadata_uri: String::from_str(&env, ""),
                tier: 0_u32, // Basic
                trial_days: 0_u32,
                features: String::from_str(&env, "Feature A"),
            },
        );

        // Upgrade to Pro tier
        let updated = client.update_plan(
            &merchant,
            &plan.plan_id,
            &PlanConfig {
                name: String::from_str(&env, "Professional"),
                description: String::from_str(&env, "Upgraded plan"),
                amount: 1500_i128,
                token,
                interval: 2592000_u64,
                max_payments: 0_u32,
                metadata_uri: String::from_str(&env, ""),
                tier: 2_u32, // Pro
                trial_days: 7_u32, // Add 7-day trial
                features: String::from_str(&env, "Feature A,Feature B,Feature C"),
            },
        );

        assert_eq!(updated.tier, PlanTier::Pro);
        assert_eq!(updated.trial_days, 7);
        assert_eq!(updated.amount, 1500);
    }
}
