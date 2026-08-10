//! # Recurra Smart Wallet — Account Abstraction Contract
//!
//! A smart wallet that acts as a user's subscription account with built-in
//! spending controls and delegated signing authority.
//!
//! ## Features
//! - **Spending Limits**: Daily and monthly caps on total outflow
//! - **Auto-Approve Threshold**: Subscriptions below this amount don't need explicit approval
//! - **Emergency Freeze**: Instantly halt all outgoing payments with one call
//! - **Session Keys**: Delegate limited authority to the frontend without wallet pop-ups
//!
//! ## Security Model
//! - Only the wallet owner can modify configuration
//! - Spending counters automatically reset at period boundaries
//! - Session keys have expiry timestamps and individual spending caps
//! - Frozen wallets reject ALL payment authorizations

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, log, symbol_short, Address, Env, String,
    Vec,
};

// ============================================================
// CONSTANTS
// ============================================================

/// Seconds in a day (86400)
const SECONDS_PER_DAY: u64 = 86_400;
/// Seconds in a month (30 days)
const SECONDS_PER_MONTH: u64 = 2_592_000;
/// Maximum number of session keys per wallet
const MAX_SESSION_KEYS: u32 = 10;

// ============================================================
// ERROR TYPES
// ============================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum WalletError {
    /// Wallet not initialized
    NotInitialized = 1,
    /// Caller is not the wallet owner
    Unauthorized = 2,
    /// Wallet is frozen — no payments allowed
    WalletFrozen = 3,
    /// Daily spending limit exceeded
    DailyLimitExceeded = 4,
    /// Monthly spending limit exceeded
    MonthlyLimitExceeded = 5,
    /// Session key not found
    SessionKeyNotFound = 6,
    /// Session key expired
    SessionKeyExpired = 7,
    /// Session key spending limit exceeded
    SessionKeyLimitExceeded = 8,
    /// Maximum session keys reached
    MaxSessionKeys = 9,
    /// Invalid input
    InvalidInput = 10,
    /// Overflow error
    Overflow = 11,
    /// Session key already exists
    SessionKeyExists = 12,
    /// Wallet already initialized
    AlreadyInitialized = 13,
    /// Amount exceeds auto-approve threshold
    RequiresExplicitApproval = 14,
}

// ============================================================
// DATA STRUCTURES
// ============================================================

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Wallet configuration
    Config,
    /// Session key data by key address
    SessionKey(Address),
    /// List of all session key addresses
    SessionKeyList,
    /// Authorization log counter
    AuthLogCounter,
    /// Authorization log entry by index
    AuthLog(u64),
}

/// Smart wallet configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct WalletConfig {
    /// Wallet owner (primary signer)
    pub owner: Address,
    /// Maximum daily spending in token units (0 = no limit)
    pub daily_limit: i128,
    /// Maximum monthly spending in token units (0 = no limit)
    pub monthly_limit: i128,
    /// Auto-approve threshold: payments below this amount are approved automatically
    /// without requiring the owner's signature (0 = all payments need approval)
    pub auto_approve_threshold: i128,
    /// Whether the wallet is frozen (emergency stop)
    pub is_frozen: bool,
    /// Total spent today
    pub daily_spent: i128,
    /// Total spent this month
    pub monthly_spent: i128,
    /// Timestamp of last daily reset
    pub last_daily_reset: u64,
    /// Timestamp of last monthly reset
    pub last_monthly_reset: u64,
    /// Timestamp when the wallet was created
    pub created_at: u64,
}

/// A delegated session key with limited authority
#[contracttype]
#[derive(Clone, Debug)]
pub struct SessionKey {
    /// The session key address (public key)
    pub key: Address,
    /// When this session key expires
    pub expires_at: u64,
    /// Maximum total amount this key can authorize
    pub max_amount: i128,
    /// Total amount authorized by this key so far
    pub total_spent: i128,
    /// Whether this key is active
    pub is_active: bool,
    /// Human-readable label (e.g., "Frontend Session")
    pub label: String,
    /// When this key was created
    pub created_at: u64,
}

/// Result of a payment authorization check
#[contracttype]
#[derive(Clone, Debug)]
pub struct AuthorizationResult {
    /// Whether the payment is authorized
    pub authorized: bool,
    /// Remaining daily budget after this payment
    pub daily_remaining: i128,
    /// Remaining monthly budget after this payment
    pub monthly_remaining: i128,
    /// Whether this was auto-approved (below threshold)
    pub auto_approved: bool,
}

/// Spending summary for dashboard display
#[contracttype]
#[derive(Clone, Debug)]
pub struct SpendingSummary {
    /// Daily limit
    pub daily_limit: i128,
    /// Daily spent
    pub daily_spent: i128,
    /// Daily remaining
    pub daily_remaining: i128,
    /// Monthly limit
    pub monthly_limit: i128,
    /// Monthly spent
    pub monthly_spent: i128,
    /// Monthly remaining
    pub monthly_remaining: i128,
    /// Whether wallet is frozen
    pub is_frozen: bool,
    /// Number of active session keys
    pub active_session_keys: u32,
    /// Auto-approve threshold
    pub auto_approve_threshold: i128,
}

/// Event emitted when a payment is authorized
#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentAuthorizedEvent {
    pub wallet_owner: Address,
    pub amount: i128,
    pub destination: Address,
    pub auto_approved: bool,
    pub daily_spent_after: i128,
    pub monthly_spent_after: i128,
}

// ============================================================
// CONTRACT
// ============================================================

#[contract]
pub struct SmartWallet;

#[contractimpl]
impl SmartWallet {
    // --------------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------------

    /// Initialize a new smart wallet for the given owner.
    ///
    /// # Arguments
    /// * `owner` — The wallet owner's address (primary signer)
    /// * `daily_limit` — Maximum daily spending (0 = no limit)
    /// * `monthly_limit` — Maximum monthly spending (0 = no limit)
    /// * `auto_approve_threshold` — Auto-approve payments below this amount
    pub fn initialize(
        env: Env,
        owner: Address,
        daily_limit: i128,
        monthly_limit: i128,
        auto_approve_threshold: i128,
    ) -> Result<WalletConfig, WalletError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(WalletError::AlreadyInitialized);
        }

        owner.require_auth();

        if daily_limit < 0 || monthly_limit < 0 || auto_approve_threshold < 0 {
            return Err(WalletError::InvalidInput);
        }

        let now = env.ledger().timestamp();

        let config = WalletConfig {
            owner: owner.clone(),
            daily_limit,
            monthly_limit,
            auto_approve_threshold,
            is_frozen: false,
            daily_spent: 0,
            monthly_spent: 0,
            last_daily_reset: now,
            last_monthly_reset: now,
            created_at: now,
        };

        env.storage().instance().set(&DataKey::Config, &config);

        let empty_keys: Vec<Address> = Vec::new(&env);
        env.storage()
            .instance()
            .set(&DataKey::SessionKeyList, &empty_keys);
        env.storage()
            .instance()
            .set(&DataKey::AuthLogCounter, &0_u64);

        env.storage().instance().extend_ttl(100, 500_000);

        log!(&env, "Smart Wallet initialized for owner={}", owner);
        Ok(config)
    }

    // --------------------------------------------------------
    // PAYMENT AUTHORIZATION
    // --------------------------------------------------------

    /// Authorize a payment from this smart wallet.
    /// Checks spending limits, freeze status, and updates counters.
    ///
    /// # Returns
    /// `AuthorizationResult` with approval status and remaining budgets.
    pub fn authorize_payment(
        env: Env,
        amount: i128,
        destination: Address,
    ) -> Result<AuthorizationResult, WalletError> {
        let mut config = Self::get_config(&env)?;

        // Check freeze
        if config.is_frozen {
            return Err(WalletError::WalletFrozen);
        }

        if amount <= 0 {
            return Err(WalletError::InvalidInput);
        }

        // Reset counters if period has elapsed
        let now = env.ledger().timestamp();
        Self::maybe_reset_counters(&mut config, now);

        // Check daily limit
        if config.daily_limit > 0 {
            let new_daily = config
                .daily_spent
                .checked_add(amount)
                .ok_or(WalletError::Overflow)?;
            if new_daily > config.daily_limit {
                return Err(WalletError::DailyLimitExceeded);
            }
        }

        // Check monthly limit
        if config.monthly_limit > 0 {
            let new_monthly = config
                .monthly_spent
                .checked_add(amount)
                .ok_or(WalletError::Overflow)?;
            if new_monthly > config.monthly_limit {
                return Err(WalletError::MonthlyLimitExceeded);
            }
        }

        // Determine if auto-approved
        let auto_approved = config.auto_approve_threshold > 0
            && amount <= config.auto_approve_threshold;

        // If not auto-approved, require owner auth
        if !auto_approved {
            config.owner.require_auth();
        }

        // Update spending counters
        config.daily_spent = config
            .daily_spent
            .checked_add(amount)
            .ok_or(WalletError::Overflow)?;
        config.monthly_spent = config
            .monthly_spent
            .checked_add(amount)
            .ok_or(WalletError::Overflow)?;

        // Save updated config
        env.storage().instance().set(&DataKey::Config, &config);

        let daily_remaining = if config.daily_limit > 0 {
            config.daily_limit - config.daily_spent
        } else {
            -1 // Unlimited
        };

        let monthly_remaining = if config.monthly_limit > 0 {
            config.monthly_limit - config.monthly_spent
        } else {
            -1 // Unlimited
        };

        // Emit event
        env.events().publish(
            (symbol_short!("wallet"), symbol_short!("auth")),
            PaymentAuthorizedEvent {
                wallet_owner: config.owner.clone(),
                amount,
                destination,
                auto_approved,
                daily_spent_after: config.daily_spent,
                monthly_spent_after: config.monthly_spent,
            },
        );

        Ok(AuthorizationResult {
            authorized: true,
            daily_remaining,
            monthly_remaining,
            auto_approved,
        })
    }

    // --------------------------------------------------------
    // CONFIGURATION
    // --------------------------------------------------------

    /// Update spending limits. Only owner can call.
    pub fn set_limits(
        env: Env,
        daily_limit: i128,
        monthly_limit: i128,
        auto_approve_threshold: i128,
    ) -> Result<WalletConfig, WalletError> {
        let mut config = Self::get_config(&env)?;
        config.owner.require_auth();

        if daily_limit < 0 || monthly_limit < 0 || auto_approve_threshold < 0 {
            return Err(WalletError::InvalidInput);
        }

        config.daily_limit = daily_limit;
        config.monthly_limit = monthly_limit;
        config.auto_approve_threshold = auto_approve_threshold;

        env.storage().instance().set(&DataKey::Config, &config);

        log!(
            &env,
            "Limits updated: daily={}, monthly={}, auto_approve={}",
            daily_limit,
            monthly_limit,
            auto_approve_threshold
        );
        Ok(config)
    }

    // --------------------------------------------------------
    // EMERGENCY FREEZE / UNFREEZE
    // --------------------------------------------------------

    /// Freeze the wallet — immediately halts ALL payment authorizations.
    /// Only the owner can call this.
    pub fn freeze(env: Env) -> Result<(), WalletError> {
        let mut config = Self::get_config(&env)?;
        config.owner.require_auth();

        config.is_frozen = true;
        env.storage().instance().set(&DataKey::Config, &config);

        env.events().publish(
            (symbol_short!("wallet"), symbol_short!("frozen")),
            config.owner.clone(),
        );

        log!(&env, "Wallet FROZEN by owner");
        Ok(())
    }

    /// Unfreeze the wallet — resume normal payment processing.
    /// Only the owner can call this.
    pub fn unfreeze(env: Env) -> Result<(), WalletError> {
        let mut config = Self::get_config(&env)?;
        config.owner.require_auth();

        config.is_frozen = false;
        env.storage().instance().set(&DataKey::Config, &config);

        env.events().publish(
            (symbol_short!("wallet"), symbol_short!("unfrozn")),
            config.owner.clone(),
        );

        log!(&env, "Wallet UNFROZEN by owner");
        Ok(())
    }

    // --------------------------------------------------------
    // SESSION KEY MANAGEMENT
    // --------------------------------------------------------

    /// Add a new session key with limited authority.
    ///
    /// # Arguments
    /// * `key` — The session key's address
    /// * `expires_at` — Expiry timestamp
    /// * `max_amount` — Maximum total amount this key can authorize
    /// * `label` — Human-readable label
    pub fn add_session_key(
        env: Env,
        key: Address,
        expires_at: u64,
        max_amount: i128,
        label: String,
    ) -> Result<SessionKey, WalletError> {
        let config = Self::get_config(&env)?;
        config.owner.require_auth();

        if max_amount <= 0 {
            return Err(WalletError::InvalidInput);
        }

        let now = env.ledger().timestamp();
        if expires_at <= now {
            return Err(WalletError::InvalidInput);
        }

        // Check if key already exists
        if env
            .storage()
            .persistent()
            .has(&DataKey::SessionKey(key.clone()))
        {
            return Err(WalletError::SessionKeyExists);
        }

        // Check max keys limit
        let mut key_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::SessionKeyList)
            .unwrap_or(Vec::new(&env));

        if key_list.len() >= MAX_SESSION_KEYS {
            return Err(WalletError::MaxSessionKeys);
        }

        let session_key = SessionKey {
            key: key.clone(),
            expires_at,
            max_amount,
            total_spent: 0,
            is_active: true,
            label,
            created_at: now,
        };

        let sk_key = DataKey::SessionKey(key.clone());
        env.storage().persistent().set(&sk_key, &session_key);
        env.storage().persistent().extend_ttl(&sk_key, 100, 500_000);

        key_list.push_back(key.clone());
        env.storage()
            .instance()
            .set(&DataKey::SessionKeyList, &key_list);

        env.events().publish(
            (symbol_short!("session"), symbol_short!("added")),
            key.clone(),
        );

        log!(&env, "Session key added: key={}", key);
        Ok(session_key)
    }

    /// Revoke a session key. Only the owner can call this.
    pub fn revoke_session_key(env: Env, key: Address) -> Result<(), WalletError> {
        let config = Self::get_config(&env)?;
        config.owner.require_auth();

        let sk_key = DataKey::SessionKey(key.clone());
        let mut session_key: SessionKey = env
            .storage()
            .persistent()
            .get(&sk_key)
            .ok_or(WalletError::SessionKeyNotFound)?;

        session_key.is_active = false;
        env.storage().persistent().set(&sk_key, &session_key);

        // Remove from list
        let key_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::SessionKeyList)
            .unwrap_or(Vec::new(&env));

        let mut new_list = Vec::new(&env);
        for i in 0..key_list.len() {
            let k = key_list.get(i).unwrap();
            if k != key {
                new_list.push_back(k);
            }
        }
        env.storage()
            .instance()
            .set(&DataKey::SessionKeyList, &new_list);

        env.events().publish(
            (symbol_short!("session"), symbol_short!("revoked")),
            key.clone(),
        );

        log!(&env, "Session key revoked: key={}", key);
        Ok(())
    }

    /// Authorize a payment using a session key (no owner signature needed).
    pub fn session_authorize(
        env: Env,
        session_key_addr: Address,
        amount: i128,
        destination: Address,
    ) -> Result<AuthorizationResult, WalletError> {
        let mut config = Self::get_config(&env)?;

        if config.is_frozen {
            return Err(WalletError::WalletFrozen);
        }

        if amount <= 0 {
            return Err(WalletError::InvalidInput);
        }

        // Validate session key
        session_key_addr.require_auth();

        let sk_key = DataKey::SessionKey(session_key_addr.clone());
        let mut session_key: SessionKey = env
            .storage()
            .persistent()
            .get(&sk_key)
            .ok_or(WalletError::SessionKeyNotFound)?;

        if !session_key.is_active {
            return Err(WalletError::SessionKeyNotFound);
        }

        let now = env.ledger().timestamp();
        if now > session_key.expires_at {
            return Err(WalletError::SessionKeyExpired);
        }

        // Check session key spending limit
        let new_spent = session_key
            .total_spent
            .checked_add(amount)
            .ok_or(WalletError::Overflow)?;
        if new_spent > session_key.max_amount {
            return Err(WalletError::SessionKeyLimitExceeded);
        }

        // Also check wallet-level limits
        Self::maybe_reset_counters(&mut config, now);

        if config.daily_limit > 0 {
            let new_daily = config
                .daily_spent
                .checked_add(amount)
                .ok_or(WalletError::Overflow)?;
            if new_daily > config.daily_limit {
                return Err(WalletError::DailyLimitExceeded);
            }
        }

        if config.monthly_limit > 0 {
            let new_monthly = config
                .monthly_spent
                .checked_add(amount)
                .ok_or(WalletError::Overflow)?;
            if new_monthly > config.monthly_limit {
                return Err(WalletError::MonthlyLimitExceeded);
            }
        }

        // Update counters
        session_key.total_spent = new_spent;
        env.storage().persistent().set(&sk_key, &session_key);

        config.daily_spent = config
            .daily_spent
            .checked_add(amount)
            .ok_or(WalletError::Overflow)?;
        config.monthly_spent = config
            .monthly_spent
            .checked_add(amount)
            .ok_or(WalletError::Overflow)?;
        env.storage().instance().set(&DataKey::Config, &config);

        let daily_remaining = if config.daily_limit > 0 {
            config.daily_limit - config.daily_spent
        } else {
            -1
        };
        let monthly_remaining = if config.monthly_limit > 0 {
            config.monthly_limit - config.monthly_spent
        } else {
            -1
        };

        env.events().publish(
            (symbol_short!("wallet"), symbol_short!("sessaut")),
            PaymentAuthorizedEvent {
                wallet_owner: config.owner.clone(),
                amount,
                destination,
                auto_approved: false,
                daily_spent_after: config.daily_spent,
                monthly_spent_after: config.monthly_spent,
            },
        );

        Ok(AuthorizationResult {
            authorized: true,
            daily_remaining,
            monthly_remaining,
            auto_approved: false,
        })
    }

    // --------------------------------------------------------
    // READ FUNCTIONS
    // --------------------------------------------------------

    /// Get the wallet configuration.
    pub fn get_wallet_config(env: Env) -> Result<WalletConfig, WalletError> {
        Self::get_config(&env)
    }

    /// Get the current spending summary with live counter resets.
    pub fn get_spending_summary(env: Env) -> Result<SpendingSummary, WalletError> {
        let mut config = Self::get_config(&env)?;
        let now = env.ledger().timestamp();
        Self::maybe_reset_counters(&mut config, now);

        // Count active session keys
        let key_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::SessionKeyList)
            .unwrap_or(Vec::new(&env));

        let mut active_keys = 0_u32;
        for i in 0..key_list.len() {
            let k = key_list.get(i).unwrap();
            if let Some(sk) = env
                .storage()
                .persistent()
                .get::<DataKey, SessionKey>(&DataKey::SessionKey(k))
            {
                if sk.is_active && now < sk.expires_at {
                    active_keys += 1;
                }
            }
        }

        Ok(SpendingSummary {
            daily_limit: config.daily_limit,
            daily_spent: config.daily_spent,
            daily_remaining: if config.daily_limit > 0 {
                config.daily_limit - config.daily_spent
            } else {
                -1
            },
            monthly_limit: config.monthly_limit,
            monthly_spent: config.monthly_spent,
            monthly_remaining: if config.monthly_limit > 0 {
                config.monthly_limit - config.monthly_spent
            } else {
                -1
            },
            is_frozen: config.is_frozen,
            active_session_keys: active_keys,
            auto_approve_threshold: config.auto_approve_threshold,
        })
    }

    /// Get a session key's details.
    pub fn get_session_key(env: Env, key: Address) -> Result<SessionKey, WalletError> {
        env.storage()
            .persistent()
            .get(&DataKey::SessionKey(key))
            .ok_or(WalletError::SessionKeyNotFound)
    }

    /// List all session keys.
    pub fn list_session_keys(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::SessionKeyList)
            .unwrap_or(Vec::new(&env))
    }

    // --------------------------------------------------------
    // INTERNAL HELPERS
    // --------------------------------------------------------

    fn get_config(env: &Env) -> Result<WalletConfig, WalletError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(WalletError::NotInitialized)
    }

    /// Reset daily/monthly counters if the period has elapsed.
    fn maybe_reset_counters(config: &mut WalletConfig, now: u64) {
        // Reset daily counter
        if now >= config.last_daily_reset + SECONDS_PER_DAY {
            config.daily_spent = 0;
            config.last_daily_reset = now;
        }

        // Reset monthly counter
        if now >= config.last_monthly_reset + SECONDS_PER_MONTH {
            config.monthly_spent = 0;
            config.last_monthly_reset = now;
        }
    }
}

// ============================================================
// TESTS
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup_wallet(env: &Env) -> (Address, SmartWalletClient) {
        let owner = Address::generate(env);

        #[allow(deprecated)]
        let contract_id = env.register_contract(None, SmartWallet);
        let client = SmartWalletClient::new(env, &contract_id);

        client.initialize(
            &owner,
            &100_000_000, // 100 USDC daily limit
            &500_000_000, // 500 USDC monthly limit
            &20_000_000,  // 20 USDC auto-approve
        );

        (owner, client)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let (owner, client) = setup_wallet(&env);

        let config = client.get_wallet_config();
        assert_eq!(config.owner, owner);
        assert_eq!(config.daily_limit, 100_000_000);
        assert_eq!(config.monthly_limit, 500_000_000);
        assert_eq!(config.auto_approve_threshold, 20_000_000);
        assert!(!config.is_frozen);
        assert_eq!(config.daily_spent, 0);
        assert_eq!(config.monthly_spent, 0);
    }

    #[test]
    fn test_authorize_payment_auto_approve() {
        let env = Env::default();
        env.mock_all_auths();

        let (_owner, client) = setup_wallet(&env);
        let destination = Address::generate(&env);

        // 10 USDC — below 20 USDC threshold → auto-approved
        let result = client.authorize_payment(&10_000_000, &destination);
        assert!(result.authorized);
        assert!(result.auto_approved);

        let summary = client.get_spending_summary();
        assert_eq!(summary.daily_spent, 10_000_000);
        assert_eq!(summary.monthly_spent, 10_000_000);
    }

    #[test]
    fn test_authorize_payment_requires_owner_above_threshold() {
        let env = Env::default();
        env.mock_all_auths();

        let (_owner, client) = setup_wallet(&env);
        let destination = Address::generate(&env);

        // 50 USDC — above 20 USDC threshold → requires owner auth
        let result = client.authorize_payment(&50_000_000, &destination);
        assert!(result.authorized);
        assert!(!result.auto_approved);
    }

    #[test]
    fn test_daily_limit_enforcement() {
        let env = Env::default();
        env.mock_all_auths();

        let (_owner, client) = setup_wallet(&env);
        let destination = Address::generate(&env);

        // Spend 90 USDC (within 100 limit)
        client.authorize_payment(&90_000_000, &destination);

        // Try to spend 20 more (would exceed 100 limit)
        let result = client.try_authorize_payment(&20_000_000, &destination);
        assert!(result.is_err());
    }

    #[test]
    fn test_freeze_blocks_payments() {
        let env = Env::default();
        env.mock_all_auths();

        let (_owner, client) = setup_wallet(&env);
        let destination = Address::generate(&env);

        // Freeze the wallet
        client.freeze();

        // Try to authorize — should fail
        let result = client.try_authorize_payment(&5_000_000, &destination);
        assert!(result.is_err());

        // Unfreeze
        client.unfreeze();

        // Should work now
        let result = client.authorize_payment(&5_000_000, &destination);
        assert!(result.authorized);
    }

    #[test]
    fn test_session_key_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();

        let (_owner, client) = setup_wallet(&env);
        let session_addr = Address::generate(&env);
        let destination = Address::generate(&env);

        let now = env.ledger().timestamp();

        // Add session key with 50 USDC max and 1-hour expiry
        let sk = client.add_session_key(
            &session_addr,
            &(now + 3600),
            &50_000_000,
            &String::from_str(&env, "Frontend Session"),
        );
        assert!(sk.is_active);

        // Authorize via session key
        let result = client.session_authorize(&session_addr, &10_000_000, &destination);
        assert!(result.authorized);

        // Check session key spent
        let sk_updated = client.get_session_key(&session_addr);
        assert_eq!(sk_updated.total_spent, 10_000_000);

        // Revoke session key
        client.revoke_session_key(&session_addr);

        // Should fail now
        let result = client.try_session_authorize(&session_addr, &5_000_000, &destination);
        assert!(result.is_err());
    }

    #[test]
    fn test_session_key_spending_limit() {
        let env = Env::default();
        env.mock_all_auths();

        let (_owner, client) = setup_wallet(&env);
        let session_addr = Address::generate(&env);
        let destination = Address::generate(&env);

        let now = env.ledger().timestamp();

        // Session key with 30 USDC max
        client.add_session_key(
            &session_addr,
            &(now + 3600),
            &30_000_000,
            &String::from_str(&env, "Limited Key"),
        );

        // Spend 25 — OK
        client.session_authorize(&session_addr, &25_000_000, &destination);

        // Spend 10 more — exceeds 30 limit
        let result = client.try_session_authorize(&session_addr, &10_000_000, &destination);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_limits() {
        let env = Env::default();
        env.mock_all_auths();

        let (_owner, client) = setup_wallet(&env);

        let updated = client.set_limits(
            &200_000_000,  // new daily
            &1_000_000_000, // new monthly
            &50_000_000,   // new auto-approve
        );

        assert_eq!(updated.daily_limit, 200_000_000);
        assert_eq!(updated.monthly_limit, 1_000_000_000);
        assert_eq!(updated.auto_approve_threshold, 50_000_000);
    }

    #[test]
    fn test_spending_summary() {
        let env = Env::default();
        env.mock_all_auths();

        let (_owner, client) = setup_wallet(&env);
        let destination = Address::generate(&env);

        client.authorize_payment(&30_000_000, &destination);
        client.authorize_payment(&20_000_000, &destination);

        let summary = client.get_spending_summary();
        assert_eq!(summary.daily_spent, 50_000_000);
        assert_eq!(summary.daily_remaining, 50_000_000); // 100 - 50
        assert_eq!(summary.monthly_spent, 50_000_000);
        assert_eq!(summary.monthly_remaining, 450_000_000); // 500 - 50
        assert!(!summary.is_frozen);
        assert_eq!(summary.active_session_keys, 0);
    }

    #[test]
    fn test_max_session_keys_limit() {
        let env = Env::default();
        env.mock_all_auths();

        let (_owner, client) = setup_wallet(&env);
        let now = env.ledger().timestamp();

        // Add MAX_SESSION_KEYS keys
        for _ in 0..MAX_SESSION_KEYS {
            let key = Address::generate(&env);
            client.add_session_key(
                &key,
                &(now + 3600),
                &10_000_000,
                &String::from_str(&env, "Key"),
            );
        }

        // 11th key should fail
        let extra_key = Address::generate(&env);
        let result = client.try_add_session_key(
            &extra_key,
            &(now + 3600),
            &10_000_000,
            &String::from_str(&env, "Extra"),
        );
        assert!(result.is_err());
    }
}
