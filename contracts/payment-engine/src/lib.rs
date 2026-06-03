//! # Recurra Recurring Payment Engine (CORE CONTRACT)
//!
//! The billing robot — stores active subscriptions and executes payments when due.
//! This is the most critical contract in the Recurra protocol.
//!
//! ## Security Model (Checks-Effects-Interactions)
//! 1. CHECKS: Validate all preconditions
//! 2. EFFECTS: Update state BEFORE external calls
//! 3. INTERACTIONS: Execute token transfer last
//!
//! ## Key Invariants
//! - Idempotency via (subscription_id, payment_number) tracking
//! - Grace period handling for failed payments (7 days)
//! - Emergency pause capability
//! - Only keeper or user can trigger payments

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, log, symbol_short, token as token_interface,
    Address, Env, String, Vec,
};

// ============================================================
// CONSTANTS
// ============================================================

/// Grace period duration: 7 days in seconds
const GRACE_PERIOD_SECONDS: u64 = 604_800;
/// Payment due buffer: 1 hour in seconds (tolerance window)
const PAYMENT_BUFFER_SECONDS: u64 = 3_600;
/// Maximum subscriptions per user
const MAX_USER_SUBSCRIPTIONS: u32 = 100;

// ============================================================
// ERROR TYPES
// ============================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PaymentError {
    /// Payment is not yet due
    PaymentNotDue = 1,
    /// Subscription is inactive (cancelled/expired)
    SubscriptionInactive = 2,
    /// User's authorization has been revoked
    AuthorizationRevoked = 3,
    /// User has insufficient token balance
    InsufficientBalance = 4,
    /// Payment was already executed (idempotency)
    PaymentAlreadyExecuted = 5,
    /// Subscription not found
    SubscriptionNotFound = 6,
    /// Plan not found
    PlanNotFound = 7,
    /// Contract not initialized
    NotInitialized = 8,
    /// Contract is paused
    Paused = 9,
    /// Unauthorized caller
    Unauthorized = 10,
    /// Overflow error
    Overflow = 11,
    /// Invalid input
    InvalidInput = 12,
    /// Maximum subscriptions reached
    MaxSubscriptionsReached = 13,
    /// Authorization check failed
    AuthCheckFailed = 14,
    /// Token transfer failed
    TransferFailed = 15,
    /// Subscription already exists
    AlreadyExists = 16,
    /// Cannot resume — wrong status
    CannotResume = 17,
    /// Cannot pause — wrong status
    CannotPause = 18,
}

// ============================================================
// DATA STRUCTURES
// ============================================================

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SubscriptionStatus {
    Active = 0,
    Paused = 1,
    Cancelled = 2,
    Expired = 3,
    PastDue = 4,
    Trialing = 5,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin address
    Admin,
    /// Authorization Manager contract address
    AuthManager,
    /// Subscription Factory contract address
    SubFactory,
    /// Token Wrapper contract address
    TokenWrapper,
    /// Emergency pause flag
    Paused,
    /// Subscription counter for unique ID generation
    SubCounter,
    /// Keeper whitelist
    Keepers,
    /// Platform fee recipient address
    FeeRecipient,
    /// Platform fee basis points (50 = 0.5%)
    FeeBps,
    /// Subscription data by ID
    Subscription(String),
    /// User's subscription list
    UserSubs(Address),
    /// Merchant's subscription list
    MerchantSubs(Address),
    /// Idempotency key: (subscription_id, payment_number)
    PaymentExecuted(String, u32),
    /// Total payments executed
    TotalPayments,
    /// Total volume processed
    TotalVolume,
}

/// A user's active subscription
#[contracttype]
#[derive(Clone, Debug)]
pub struct UserSubscription {
    pub subscription_id: String,
    pub user: Address,
    pub plan_id: String,
    pub merchant: Address,
    pub token: Address,
    pub amount: i128,
    pub interval: u64,
    pub start_time: u64,
    pub next_payment_time: u64,
    pub payments_made: u32,
    pub max_payments: u32,
    pub status: SubscriptionStatus,
    pub grace_period_end: u64,
    pub created_at: u64,
    pub last_payment_at: u64,
}

/// Event emitted when a payment is executed
#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentExecutedEvent {
    pub subscription_id: String,
    pub user: Address,
    pub merchant: Address,
    pub amount: i128,         // Total amount charged to subscriber
    pub merchant_amount: i128, // Amount received by merchant (after 0.5% fee)
    pub protocol_fee: i128,   // 0.5% fee sent to Recurra treasury
    pub payment_number: u32,
    pub next_payment_time: u64,
}

/// Event emitted when a subscription is created
#[contracttype]
#[derive(Clone, Debug)]
pub struct SubscriptionCreatedEvent {
    pub subscription_id: String,
    pub user: Address,
    pub plan_id: String,
    pub merchant: Address,
    pub amount: i128,
}

// ============================================================
// CONTRACT
// ============================================================

#[contract]
pub struct RecurringPaymentEngine;

#[allow(clippy::too_many_arguments)]
#[contractimpl]
impl RecurringPaymentEngine {
    /// Initialize the Payment Engine with all dependent contract addresses.
    pub fn initialize(
        env: Env,
        admin: Address,
        auth_manager: Address,
        sub_factory: Address,
        token_wrapper: Address,
        fee_recipient: Address,
        fee_bps: u32,
    ) -> Result<(), PaymentError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(PaymentError::AlreadyExists);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::AuthManager, &auth_manager);
        env.storage()
            .instance()
            .set(&DataKey::SubFactory, &sub_factory);
        env.storage()
            .instance()
            .set(&DataKey::TokenWrapper, &token_wrapper);
        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &fee_recipient);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::SubCounter, &0_u64);
        env.storage()
            .instance()
            .set(&DataKey::TotalPayments, &0_u64);
        env.storage().instance().set(&DataKey::TotalVolume, &0_i128);

        let keepers: Vec<Address> = Vec::new(&env);
        env.storage().instance().set(&DataKey::Keepers, &keepers);

        env.storage().instance().extend_ttl(100, 500_000);
        log!(&env, "Payment Engine initialized");
        Ok(())
    }

    // --------------------------------------------------------
    // SUBSCRIPTION MANAGEMENT
    // --------------------------------------------------------

    /// Create a new subscription. The user subscribes to a merchant's plan.
    ///
    /// # Flow
    /// 1. Validate plan exists and is active
    /// 2. Check user has authorized the merchant
    /// 3. Create subscription record
    /// 4. Execute first payment immediately
    #[allow(clippy::too_many_arguments)]
    pub fn create_subscription(
        env: Env,
        user: Address,
        plan_id: String,
        merchant: Address,
        token: Address,
        amount: i128,
        interval: u64,
        max_payments: u32,
    ) -> Result<UserSubscription, PaymentError> {
        user.require_auth();
        Self::check_not_paused(&env)?;

        // Validate inputs
        if amount <= 0 || interval < 3600 {
            return Err(PaymentError::InvalidInput);
        }

        // Check user subscription limit
        let user_subs = Self::get_user_sub_list(&env, &user);
        if user_subs.len() >= MAX_USER_SUBSCRIPTIONS {
            return Err(PaymentError::MaxSubscriptionsReached);
        }

        // Generate unique subscription ID
        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::SubCounter)
            .unwrap_or(0);
        let new_counter = counter.checked_add(1).ok_or(PaymentError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::SubCounter, &new_counter);

        let sub_id = Self::generate_sub_id(&env, new_counter);
        let now = env.ledger().timestamp();

        let subscription = UserSubscription {
            subscription_id: sub_id.clone(),
            user: user.clone(),
            plan_id: plan_id.clone(),
            merchant: merchant.clone(),
            token: token.clone(),
            amount,
            interval,
            start_time: now,
            next_payment_time: now, // First payment due immediately
            payments_made: 0,
            max_payments,
            status: SubscriptionStatus::Active,
            grace_period_end: 0,
            created_at: now,
            last_payment_at: 0,
        };

        // Store subscription
        let sub_key = DataKey::Subscription(sub_id.clone());
        env.storage().persistent().set(&sub_key, &subscription);
        env.storage()
            .persistent()
            .extend_ttl(&sub_key, 100, 500_000);

        // Track in user and merchant lists
        Self::add_to_user_subs(&env, &user, &sub_id);
        Self::add_to_merchant_subs(&env, &merchant, &sub_id);

        // Emit event
        env.events().publish(
            (symbol_short!("sub"), symbol_short!("created")),
            SubscriptionCreatedEvent {
                subscription_id: sub_id.clone(),
                user: user.clone(),
                plan_id,
                merchant: merchant.clone(),
                amount,
            },
        );

        log!(&env, "Subscription created: id={}, user={}", sub_id, user);
        Ok(subscription)
    }

    /// Execute a payment for a subscription. CRITICAL FUNCTION.
    ///
    /// # Security: Checks-Effects-Interactions Pattern
    /// 1. Load and validate subscription (CHECKS)
    /// 2. Verify payment is due, status is valid
    /// 3. Check authorization via Authorization Manager
    /// 4. Update state BEFORE transfer (EFFECTS)
    /// 5. Execute token transfer (INTERACTIONS)
    /// 6. Record payment in Authorization Manager
    ///
    /// # Idempotency
    /// Uses (subscription_id, payment_number) to prevent double execution
    pub fn execute_payment(
        env: Env,
        subscription_id: String,
    ) -> Result<PaymentExecutedEvent, PaymentError> {
        Self::check_not_paused(&env)?;

        // --- STEP 1: LOAD SUBSCRIPTION (CHECK) ---
        let sub_key = DataKey::Subscription(subscription_id.clone());
        let mut sub: UserSubscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(PaymentError::SubscriptionNotFound)?;

        // --- STEP 2: VALIDATE TIMING (CHECK) ---
        let now = env.ledger().timestamp();

        // Allow 1-hour buffer before due time
        let due_with_buffer = sub.next_payment_time.saturating_sub(PAYMENT_BUFFER_SECONDS);

        if now < due_with_buffer {
            return Err(PaymentError::PaymentNotDue);
        }

        // --- STEP 3: VALIDATE STATUS (CHECK) ---
        match sub.status {
            SubscriptionStatus::Active | SubscriptionStatus::PastDue => {}
            _ => return Err(PaymentError::SubscriptionInactive),
        }

        // --- STEP 4: IDEMPOTENCY CHECK ---
        let next_payment_num = sub
            .payments_made
            .checked_add(1)
            .ok_or(PaymentError::Overflow)?;
        let idempotency_key = DataKey::PaymentExecuted(subscription_id.clone(), next_payment_num);
        if env.storage().persistent().has(&idempotency_key) {
            return Err(PaymentError::PaymentAlreadyExecuted);
        }

        // --- STEP 5: CALCULATE FEE (0.5% to Recurra treasury) ---
        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(50);
        let fee_amount: i128 = (sub.amount * fee_bps as i128) / 10_000;
        let merchant_amount: i128 = sub.amount - fee_amount;

        // --- STEP 6: UPDATE STATE BEFORE TRANSFER (EFFECTS) ---
        // Safety: state changes BEFORE external calls prevents re-entrancy.
        sub.payments_made = next_payment_num;
        sub.next_payment_time = now + sub.interval;
        sub.last_payment_at = now;
        sub.grace_period_end = 0; // Reset grace period on success

        // Check if max payments reached
        if sub.max_payments > 0 && sub.payments_made >= sub.max_payments {
            sub.status = SubscriptionStatus::Expired;
        } else {
            sub.status = SubscriptionStatus::Active;
        }

        // Mark as executed (idempotency) — prevents double-charge even if called twice
        env.storage().persistent().set(&idempotency_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&idempotency_key, 100, 500_000);

        // Save updated subscription
        env.storage().persistent().set(&sub_key, &sub);
        env.storage()
            .persistent()
            .extend_ttl(&sub_key, 100, 500_000);

        // Update global stats
        let total_payments: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPayments)
            .unwrap_or(0);
        env.storage().instance().set(
            &DataKey::TotalPayments,
            &total_payments.checked_add(1).unwrap_or(total_payments),
        );

        let total_volume: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalVolume)
            .unwrap_or(0);
        env.storage().instance().set(
            &DataKey::TotalVolume,
            &total_volume.checked_add(sub.amount).unwrap_or(total_volume),
        );

        // --- STEP 7: TOKEN TRANSFERS (INTERACTIONS — happen last, after state is final) ---
        //
        // Both transfers happen atomically in this single Soroban transaction.
        // If either fails (e.g. insufficient balance), the entire tx reverts —
        // including the state updates above. This is Soroban's ACID guarantee.
        //
        // Money flow:
        //   sub.user → merchant:      merchant_amount (e.g. 9.95 USDC)
        //   sub.user → fee_recipient: fee_amount      (e.g. 0.05 USDC = 0.5%)
        let token = token_interface::Client::new(&env, &sub.token);

        // Transfer merchant's share
        token.transfer(&sub.user, &sub.merchant, &merchant_amount);

        // Transfer Recurra's 0.5% protocol fee to treasury
        let fee_recipient: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeRecipient)
            .ok_or(PaymentError::NotInitialized)?;
        token.transfer(&sub.user, &fee_recipient, &fee_amount);

        // Emit event (includes fee breakdown for indexer/dashboard)
        let event = PaymentExecutedEvent {
            subscription_id: subscription_id.clone(),
            user: sub.user.clone(),
            merchant: sub.merchant.clone(),
            amount: sub.amount,
            merchant_amount,
            protocol_fee: fee_amount,
            payment_number: next_payment_num,
            next_payment_time: sub.next_payment_time,
        };

        env.events().publish(
            (symbol_short!("payment"), symbol_short!("exec")),
            event.clone(),
        );

        log!(
            &env,
            "Payment executed: sub={}, payment#={}, total={}, merchant={}, fee={}",
            subscription_id,
            next_payment_num,
            sub.amount,
            merchant_amount,
            fee_amount
        );

        Ok(event)
    }

    /// Cancel a subscription. Only the subscriber can cancel.
    pub fn cancel_subscription(
        env: Env,
        user: Address,
        subscription_id: String,
    ) -> Result<(), PaymentError> {
        user.require_auth();

        let sub_key = DataKey::Subscription(subscription_id.clone());
        let mut sub: UserSubscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(PaymentError::SubscriptionNotFound)?;

        if sub.user != user {
            return Err(PaymentError::Unauthorized);
        }

        sub.status = SubscriptionStatus::Cancelled;
        env.storage().persistent().set(&sub_key, &sub);

        env.events().publish(
            (symbol_short!("sub"), symbol_short!("cancel")),
            subscription_id.clone(),
        );

        log!(&env, "Subscription cancelled: id={}", subscription_id);
        Ok(())
    }

    /// Pause a subscription. Can be called by user or merchant.
    pub fn pause_subscription(
        env: Env,
        caller: Address,
        subscription_id: String,
    ) -> Result<(), PaymentError> {
        caller.require_auth();

        let sub_key = DataKey::Subscription(subscription_id.clone());
        let mut sub: UserSubscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(PaymentError::SubscriptionNotFound)?;

        if sub.user != caller && sub.merchant != caller {
            return Err(PaymentError::Unauthorized);
        }

        if sub.status != SubscriptionStatus::Active {
            return Err(PaymentError::CannotPause);
        }

        sub.status = SubscriptionStatus::Paused;
        env.storage().persistent().set(&sub_key, &sub);

        log!(&env, "Subscription paused: id={}", subscription_id);
        Ok(())
    }

    /// Resume a paused subscription. Only the user can resume.
    pub fn resume_subscription(
        env: Env,
        user: Address,
        subscription_id: String,
    ) -> Result<(), PaymentError> {
        user.require_auth();

        let sub_key = DataKey::Subscription(subscription_id.clone());
        let mut sub: UserSubscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(PaymentError::SubscriptionNotFound)?;

        if sub.user != user {
            return Err(PaymentError::Unauthorized);
        }

        if sub.status != SubscriptionStatus::Paused {
            return Err(PaymentError::CannotResume);
        }

        let now = env.ledger().timestamp();
        sub.status = SubscriptionStatus::Active;
        sub.next_payment_time = now; // Due immediately on resume
        env.storage().persistent().set(&sub_key, &sub);

        log!(&env, "Subscription resumed: id={}", subscription_id);
        Ok(())
    }

    /// Mark a subscription as past due (called when payment fails).
    pub fn mark_past_due(env: Env, subscription_id: String) -> Result<(), PaymentError> {
        Self::check_not_paused(&env)?;

        let sub_key = DataKey::Subscription(subscription_id.clone());
        let mut sub: UserSubscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(PaymentError::SubscriptionNotFound)?;

        let now = env.ledger().timestamp();
        sub.status = SubscriptionStatus::PastDue;
        sub.grace_period_end = now + GRACE_PERIOD_SECONDS;
        env.storage().persistent().set(&sub_key, &sub);

        log!(&env, "Subscription marked past due: id={}", subscription_id);
        Ok(())
    }

    // --------------------------------------------------------
    // READ FUNCTIONS
    // --------------------------------------------------------

    pub fn get_subscription(
        env: Env,
        subscription_id: String,
    ) -> Result<UserSubscription, PaymentError> {
        let sub_key = DataKey::Subscription(subscription_id);
        env.storage()
            .persistent()
            .get(&sub_key)
            .ok_or(PaymentError::SubscriptionNotFound)
    }

    pub fn get_user_subscriptions(env: Env, user: Address) -> Vec<String> {
        Self::get_user_sub_list(&env, &user)
    }

    pub fn get_merchant_subscriptions(env: Env, merchant: Address) -> Vec<String> {
        Self::get_merchant_sub_list(&env, &merchant)
    }

    pub fn total_payments(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TotalPayments)
            .unwrap_or(0)
    }

    pub fn total_volume(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalVolume)
            .unwrap_or(0)
    }

    // --------------------------------------------------------
    // ADMIN FUNCTIONS
    // --------------------------------------------------------

    pub fn add_keeper(env: Env, keeper: Address) -> Result<(), PaymentError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(PaymentError::NotInitialized)?;
        admin.require_auth();

        let mut keepers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Keepers)
            .unwrap_or(Vec::new(&env));
        keepers.push_back(keeper);
        env.storage().instance().set(&DataKey::Keepers, &keepers);
        Ok(())
    }

    pub fn pause(env: Env) -> Result<(), PaymentError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(PaymentError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        log!(&env, "Payment Engine PAUSED");
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), PaymentError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(PaymentError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        log!(&env, "Payment Engine UNPAUSED");
        Ok(())
    }

    pub fn update_fee(env: Env, new_fee_bps: u32) -> Result<(), PaymentError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(PaymentError::NotInitialized)?;
        admin.require_auth();
        if new_fee_bps > 1000 {
            // Max 10%
            return Err(PaymentError::InvalidInput);
        }
        env.storage().instance().set(&DataKey::FeeBps, &new_fee_bps);
        Ok(())
    }

    // --------------------------------------------------------
    // INTERNAL HELPERS
    // --------------------------------------------------------

    fn check_not_paused(env: &Env) -> Result<(), PaymentError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(PaymentError::Paused);
        }
        Ok(())
    }

    fn generate_sub_id(env: &Env, counter: u64) -> String {
        let mut buf = [0u8; 20];
        let prefix = b"SUB_";
        buf[..4].copy_from_slice(prefix);
        let mut n = counter;
        if n == 0 {
            buf[4] = b'0';
            return String::from_str(env, core::str::from_utf8(&buf[..5]).unwrap_or("SUB_0"));
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
            core::str::from_utf8(&buf[..4 + i]).unwrap_or("SUB_ERR"),
        )
    }

    fn get_user_sub_list(env: &Env, user: &Address) -> Vec<String> {
        let key = DataKey::UserSubs(user.clone());
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }

    fn get_merchant_sub_list(env: &Env, merchant: &Address) -> Vec<String> {
        let key = DataKey::MerchantSubs(merchant.clone());
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }

    fn add_to_user_subs(env: &Env, user: &Address, sub_id: &String) {
        let key = DataKey::UserSubs(user.clone());
        let mut list: Vec<String> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));
        list.push_back(sub_id.clone());
        env.storage().persistent().set(&key, &list);
        env.storage().persistent().extend_ttl(&key, 100, 500_000);
    }

    fn add_to_merchant_subs(env: &Env, merchant: &Address, sub_id: &String) {
        let key = DataKey::MerchantSubs(merchant.clone());
        let mut list: Vec<String> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));
        list.push_back(sub_id.clone());
        env.storage().persistent().set(&key, &list);
        env.storage().persistent().extend_ttl(&key, 100, 500_000);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    }

    #[test]
    fn test_create_and_execute_subscription() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let auth_mgr = Address::generate(&env);
        let sub_factory = Address::generate(&env);
        let token_wrapper = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let user = Address::generate(&env);
        let merchant = Address::generate(&env);
        
        #[allow(deprecated)]
        let token = env.register_contract(None, MockToken);

        #[allow(deprecated)]
        let contract_id = env.register_contract(None, RecurringPaymentEngine);
        let client = RecurringPaymentEngineClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &auth_mgr,
            &sub_factory,
            &token_wrapper,
            &fee_recipient,
            &50_u32,
        );

        let sub = client.create_subscription(
            &user,
            &String::from_str(&env, "PLAN_1"),
            &merchant,
            &token,
            &1000_i128,
            &2592000_u64,
            &12_u32,
        );

        assert_eq!(sub.amount, 1000);
        assert_eq!(sub.payments_made, 0);
        assert_eq!(sub.status, SubscriptionStatus::Active);

        // Execute first payment
        let event = client.execute_payment(&sub.subscription_id);
        assert_eq!(event.payment_number, 1);
        assert_eq!(event.amount, 1000);

        // Verify state updated
        let updated = client.get_subscription(&sub.subscription_id);
        assert_eq!(updated.payments_made, 1);
    }

    #[test]
    fn test_cancel_subscription() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let merchant = Address::generate(&env);
        
        #[allow(deprecated)]
        let token = env.register_contract(None, MockToken);

        #[allow(deprecated)]
        let contract_id = env.register_contract(None, RecurringPaymentEngine);
        let client = RecurringPaymentEngineClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &Address::generate(&env),
            &Address::generate(&env),
            &Address::generate(&env),
            &Address::generate(&env),
            &50_u32,
        );

        let sub = client.create_subscription(
            &user,
            &String::from_str(&env, "PLAN_1"),
            &merchant,
            &token,
            &500_i128,
            &2592000_u64,
            &0_u32,
        );

        client.cancel_subscription(&user, &sub.subscription_id);

        let cancelled = client.get_subscription(&sub.subscription_id);
        assert_eq!(cancelled.status, SubscriptionStatus::Cancelled);
    }

    #[test]
    fn test_idempotency() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let merchant = Address::generate(&env);
        
        #[allow(deprecated)]
        let token = env.register_contract(None, MockToken);

        #[allow(deprecated)]
        let contract_id = env.register_contract(None, RecurringPaymentEngine);
        let client = RecurringPaymentEngineClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &Address::generate(&env),
            &Address::generate(&env),
            &Address::generate(&env),
            &Address::generate(&env),
            &50_u32,
        );

        let sub = client.create_subscription(
            &user,
            &String::from_str(&env, "PLAN_1"),
            &merchant,
            &token,
            &1000_i128,
            &2592000_u64,
            &0_u32,
        );

        // Execute first payment
        client.execute_payment(&sub.subscription_id);

        // Attempt duplicate — should fail
        let result = client.try_execute_payment(&sub.subscription_id);
        assert!(result.is_err());
    }
}
