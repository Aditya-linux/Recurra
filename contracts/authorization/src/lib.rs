//! # Recurra Authorization Manager
//!
//! Permission system that stores and enforces user authorizations
//! for merchants to pull funds via recurring payments.
//!
//! ## Security Model
//! - All state-modifying functions require `require_auth()`
//! - `record_payment` is restricted to the Payment Engine address only
//! - Integer overflow protection via `checked_add`
//! - Authorization can be revoked instantly by the user
//!
//! ## Key Invariants
//! 1. Only the user can grant or revoke authorization
//! 2. Only the Payment Engine can record payments
//! 3. total_spent can never exceed total_allowed
//! 4. A revoked authorization permanently blocks payments

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
pub enum AuthError {
    /// Authorization not found for the given user-merchant-token tuple
    NotFound = 1,
    /// Authorization has been revoked by the user
    Revoked = 2,
    /// Payment amount exceeds the per-payment maximum
    ExceedsMaxPerPayment = 3,
    /// Payment would exceed the total lifetime allowance
    ExceedsTotalAllowed = 4,
    /// Authorization has expired
    Expired = 5,
    /// Caller is not the authorized Payment Engine
    UnauthorizedCaller = 6,
    /// Arithmetic overflow detected
    Overflow = 7,
    /// Authorization already exists (use update instead)
    AlreadyExists = 8,
    /// Contract has not been initialized
    NotInitialized = 9,
    /// Contract is paused for emergency
    Paused = 10,
    /// Invalid input parameter
    InvalidInput = 11,
}

// ============================================================
// DATA STRUCTURES
// ============================================================

/// Storage key for contract-level configuration
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The address of the Payment Engine contract (only caller allowed for record_payment)
    PaymentEngine,
    /// Admin address for emergency operations
    Admin,
    /// Emergency pause flag
    Paused,
    /// Authorization record keyed by (user, merchant, token)
    Auth(Address, Address, Address),
    /// List of all authorizations for a user
    UserAuths(Address),
    /// List of all authorizations for a merchant
    MerchantAuths(Address),
}

/// An authorization record granting a merchant permission to pull funds
#[contracttype]
#[derive(Clone, Debug)]
pub struct Authorization {
    /// Subscriber's address (C-Address)
    pub user: Address,
    /// Merchant's address (C-Address)
    pub merchant: Address,
    /// Token contract address (e.g., USDC)
    pub token: Address,
    /// Maximum amount per individual payment
    pub max_per_payment: i128,
    /// Total lifetime allowance
    pub total_allowed: i128,
    /// Total amount already pulled
    pub total_spent: i128,
    /// Optional expiration timestamp (ledger timestamp)
    pub expiry: u64,
    /// Whether this authorization has been revoked
    pub revoked: bool,
    /// Timestamp when this authorization was created
    pub created_at: u64,
    /// Number of payments executed under this authorization
    pub payment_count: u32,
}

/// Event data emitted on authorization grant
#[contracttype]
#[derive(Clone, Debug)]
pub struct AuthGrantedEvent {
    pub user: Address,
    pub merchant: Address,
    pub token: Address,
    pub max_per_payment: i128,
    pub total_allowed: i128,
}

/// Event data emitted on authorization revocation
#[contracttype]
#[derive(Clone, Debug)]
pub struct AuthRevokedEvent {
    pub user: Address,
    pub merchant: Address,
    pub token: Address,
}

// ============================================================
// CONTRACT
// ============================================================

#[contract]
pub struct AuthorizationManager;

#[contractimpl]
impl AuthorizationManager {
    // --------------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------------

    /// Initialize the contract with admin and payment engine addresses.
    /// Can only be called once.
    ///
    /// # Arguments
    /// * `admin` — Admin address (multi-sig recommended)
    /// * `payment_engine` — Address of the Payment Engine contract
    ///
    /// # Security
    /// - Sets the authorized Payment Engine address
    /// - Only admin can perform emergency operations
    pub fn initialize(env: Env, admin: Address, payment_engine: Address) -> Result<(), AuthError> {
        // Ensure not already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(AuthError::AlreadyExists);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PaymentEngine, &payment_engine);
        env.storage().instance().set(&DataKey::Paused, &false);

        // Extend instance TTL for long-lived contract
        env.storage().instance().extend_ttl(100, 500_000);

        log!(&env, "Authorization Manager initialized");
        Ok(())
    }

    // --------------------------------------------------------
    // USER FUNCTIONS
    // --------------------------------------------------------

    /// Grant authorization for a merchant to pull funds.
    ///
    /// # Arguments
    /// * `user` — The subscriber granting permission
    /// * `merchant` — The merchant receiving permission
    /// * `token` — Token contract address (e.g., USDC)
    /// * `max_per_payment` — Maximum per individual payment
    /// * `total_allowed` — Total lifetime allowance
    /// * `expiry` — Expiration timestamp (0 = no expiry)
    ///
    /// # Security
    /// - Requires user authentication (`require_auth`)
    /// - Validates all input parameters
    /// - Prevents duplicate authorizations
    pub fn authorize(
        env: Env,
        user: Address,
        merchant: Address,
        token: Address,
        max_per_payment: i128,
        total_allowed: i128,
        expiry: u64,
    ) -> Result<Authorization, AuthError> {
        // Security: require user authentication
        user.require_auth();

        // Validate contract is not paused
        Self::check_not_paused(&env)?;

        // Input validation
        if max_per_payment <= 0 || total_allowed <= 0 {
            return Err(AuthError::InvalidInput);
        }
        if max_per_payment > total_allowed {
            return Err(AuthError::InvalidInput);
        }

        let key = DataKey::Auth(user.clone(), merchant.clone(), token.clone());

        // Check for existing non-revoked authorization
        if let Some(existing) = env
            .storage()
            .persistent()
            .get::<DataKey, Authorization>(&key)
        {
            if !existing.revoked {
                return Err(AuthError::AlreadyExists);
            }
        }

        let now = env.ledger().timestamp();

        let auth = Authorization {
            user: user.clone(),
            merchant: merchant.clone(),
            token: token.clone(),
            max_per_payment,
            total_allowed,
            total_spent: 0,
            expiry,
            revoked: false,
            created_at: now,
            payment_count: 0,
        };

        // Store authorization
        env.storage().persistent().set(&key, &auth);
        env.storage().persistent().extend_ttl(&key, 100, 500_000);

        // Track user's authorizations
        Self::add_to_user_list(&env, &user, &merchant, &token);

        // Track merchant's authorizations
        Self::add_to_merchant_list(&env, &merchant, &user, &token);

        // Emit event
        env.events().publish(
            (symbol_short!("auth"), symbol_short!("granted")),
            AuthGrantedEvent {
                user: user.clone(),
                merchant: merchant.clone(),
                token: token.clone(),
                max_per_payment,
                total_allowed,
            },
        );

        log!(
            &env,
            "Authorization granted: user={}, merchant={}",
            user,
            merchant
        );
        Ok(auth)
    }

    /// Revoke authorization for a merchant. Instant and permanent.
    ///
    /// # Arguments
    /// * `user` — The subscriber revoking permission
    /// * `merchant` — The merchant losing permission
    /// * `token` — Token contract address
    ///
    /// # Security
    /// - Requires user authentication
    /// - Revocation is permanent — a new authorization must be created
    pub fn revoke(
        env: Env,
        user: Address,
        merchant: Address,
        token: Address,
    ) -> Result<(), AuthError> {
        // Security: require user authentication
        user.require_auth();

        let key = DataKey::Auth(user.clone(), merchant.clone(), token.clone());

        let mut auth: Authorization = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(AuthError::NotFound)?;

        if auth.revoked {
            return Err(AuthError::Revoked);
        }

        // EFFECTS: Update state before any external calls
        auth.revoked = true;
        env.storage().persistent().set(&key, &auth);

        // Emit event
        env.events().publish(
            (symbol_short!("auth"), symbol_short!("revoked")),
            AuthRevokedEvent {
                user: user.clone(),
                merchant: merchant.clone(),
                token: token.clone(),
            },
        );

        log!(
            &env,
            "Authorization revoked: user={}, merchant={}",
            user,
            merchant
        );
        Ok(())
    }

    // --------------------------------------------------------
    // PAYMENT ENGINE FUNCTIONS (Restricted Access)
    // --------------------------------------------------------

    /// Check if an authorization is valid for a given payment amount.
    /// Called by the Payment Engine before executing a payment.
    ///
    /// # Arguments
    /// * `user` — Subscriber address
    /// * `merchant` — Merchant address
    /// * `token` — Token contract address
    /// * `amount` — Payment amount to validate
    ///
    /// # Returns
    /// `true` if the payment is authorized, error otherwise
    ///
    /// # Security
    /// - Pure read operation — no auth required
    /// - Validates all authorization constraints
    pub fn check_authorization(
        env: Env,
        user: Address,
        merchant: Address,
        token: Address,
        amount: i128,
    ) -> Result<bool, AuthError> {
        Self::check_not_paused(&env)?;

        let key = DataKey::Auth(user.clone(), merchant.clone(), token.clone());

        let auth: Authorization = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(AuthError::NotFound)?;

        // Check revocation
        if auth.revoked {
            return Err(AuthError::Revoked);
        }

        // Check expiry (0 = no expiry)
        if auth.expiry > 0 {
            let now = env.ledger().timestamp();
            if now > auth.expiry {
                return Err(AuthError::Expired);
            }
        }

        // Check per-payment limit
        if amount > auth.max_per_payment {
            return Err(AuthError::ExceedsMaxPerPayment);
        }

        // Check total allowance with overflow protection
        let new_total = auth
            .total_spent
            .checked_add(amount)
            .ok_or(AuthError::Overflow)?;

        if new_total > auth.total_allowed {
            return Err(AuthError::ExceedsTotalAllowed);
        }

        Ok(true)
    }

    /// Record a successful payment against an authorization.
    /// **RESTRICTED:** Only callable by the Payment Engine contract.
    ///
    /// # Arguments
    /// * `user` — Subscriber address
    /// * `merchant` — Merchant address
    /// * `token` — Token contract address
    /// * `amount` — Payment amount executed
    ///
    /// # Security
    /// - Caller must be the registered Payment Engine address
    /// - Uses `checked_add` for overflow protection
    /// - Updates total_spent and payment_count atomically
    pub fn record_payment(
        env: Env,
        user: Address,
        merchant: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), AuthError> {
        Self::check_not_paused(&env)?;

        // CRITICAL SECURITY: Only Payment Engine can call this
        let payment_engine: Address = env
            .storage()
            .instance()
            .get(&DataKey::PaymentEngine)
            .ok_or(AuthError::NotInitialized)?;

        payment_engine.require_auth();

        let key = DataKey::Auth(user.clone(), merchant.clone(), token.clone());

        let mut auth: Authorization = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(AuthError::NotFound)?;

        // Verify authorization is still valid
        if auth.revoked {
            return Err(AuthError::Revoked);
        }

        // Overflow-protected addition
        auth.total_spent = auth
            .total_spent
            .checked_add(amount)
            .ok_or(AuthError::Overflow)?;

        // Verify we haven't exceeded total (defense in depth)
        if auth.total_spent > auth.total_allowed {
            return Err(AuthError::ExceedsTotalAllowed);
        }

        auth.payment_count = auth
            .payment_count
            .checked_add(1)
            .ok_or(AuthError::Overflow)?;

        // EFFECTS: Update state
        env.storage().persistent().set(&key, &auth);
        env.storage().persistent().extend_ttl(&key, 100, 500_000);

        log!(
            &env,
            "Payment recorded: user={}, merchant={}, amount={}, total_spent={}",
            user,
            merchant,
            amount,
            auth.total_spent
        );
        Ok(())
    }

    // --------------------------------------------------------
    // READ FUNCTIONS
    // --------------------------------------------------------

    /// Get authorization details for a user-merchant-token tuple.
    pub fn get_authorization(
        env: Env,
        user: Address,
        merchant: Address,
        token: Address,
    ) -> Result<Authorization, AuthError> {
        let key = DataKey::Auth(user, merchant, token);
        env.storage()
            .persistent()
            .get(&key)
            .ok_or(AuthError::NotFound)
    }

    /// Get all authorizations for a user (returns list of (merchant, token) tuples).
    pub fn get_user_authorizations(env: Env, user: Address) -> Vec<(Address, Address)> {
        let key = DataKey::UserAuths(user);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
    }

    /// Get all authorizations for a merchant (returns list of (user, token) tuples).
    pub fn get_merchant_authorizations(env: Env, merchant: Address) -> Vec<(Address, Address)> {
        let key = DataKey::MerchantAuths(merchant);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
    }

    // --------------------------------------------------------
    // ADMIN FUNCTIONS
    // --------------------------------------------------------

    /// Emergency pause — halts all operations.
    /// Requires admin authentication.
    pub fn pause(env: Env) -> Result<(), AuthError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(AuthError::NotInitialized)?;

        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);

        log!(&env, "CONTRACT PAUSED by admin");
        Ok(())
    }

    /// Resume operations after emergency pause.
    /// Requires admin authentication.
    pub fn unpause(env: Env) -> Result<(), AuthError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(AuthError::NotInitialized)?;

        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);

        log!(&env, "CONTRACT UNPAUSED by admin");
        Ok(())
    }

    /// Update the Payment Engine address.
    /// Requires admin authentication.
    pub fn update_payment_engine(env: Env, new_payment_engine: Address) -> Result<(), AuthError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(AuthError::NotInitialized)?;

        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::PaymentEngine, &new_payment_engine);

        log!(&env, "Payment Engine updated to {}", new_payment_engine);
        Ok(())
    }

    // --------------------------------------------------------
    // INTERNAL HELPERS
    // --------------------------------------------------------

    /// Check if the contract is paused
    fn check_not_paused(env: &Env) -> Result<(), AuthError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);

        if paused {
            return Err(AuthError::Paused);
        }
        Ok(())
    }

    /// Add an authorization to the user's tracking list
    fn add_to_user_list(env: &Env, user: &Address, merchant: &Address, token: &Address) {
        let key = DataKey::UserAuths(user.clone());
        let mut list: Vec<(Address, Address)> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));

        list.push_back((merchant.clone(), token.clone()));
        env.storage().persistent().set(&key, &list);
        env.storage().persistent().extend_ttl(&key, 100, 500_000);
    }

    /// Add an authorization to the merchant's tracking list
    fn add_to_merchant_list(env: &Env, merchant: &Address, user: &Address, token: &Address) {
        let key = DataKey::MerchantAuths(merchant.clone());
        let mut list: Vec<(Address, Address)> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));

        list.push_back((user.clone(), token.clone()));
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
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn setup_env() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payment_engine = Address::generate(&env);
        let user = Address::generate(&env);
        let merchant = Address::generate(&env);

        // Initialize contract
        let contract_id = env.register(AuthorizationManager, ());
        let client = AuthorizationManagerClient::new(&env, &contract_id);
        client.initialize(&admin, &payment_engine);

        (env, user, merchant, payment_engine, admin)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payment_engine = Address::generate(&env);

        let contract_id = env.register(AuthorizationManager, ());
        let client = AuthorizationManagerClient::new(&env, &contract_id);

        client.initialize(&admin, &payment_engine);
    }

    #[test]
    fn test_authorize_and_check() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payment_engine = Address::generate(&env);
        let user = Address::generate(&env);
        let merchant = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register(AuthorizationManager, ());
        let client = AuthorizationManagerClient::new(&env, &contract_id);

        client.initialize(&admin, &payment_engine);

        // Authorize merchant
        let auth = client.authorize(
            &user,
            &merchant,
            &token,
            &1000_i128,  // max per payment: $10.00
            &12000_i128, // total allowed: $120.00
            &0_u64,      // no expiry
        );

        assert_eq!(auth.max_per_payment, 1000);
        assert_eq!(auth.total_allowed, 12000);
        assert_eq!(auth.total_spent, 0);
        assert!(!auth.revoked);

        // Check authorization — should succeed
        let result = client.check_authorization(&user, &merchant, &token, &1000_i128);
        assert!(result);
    }

    #[test]
    fn test_revoke_authorization() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payment_engine = Address::generate(&env);
        let user = Address::generate(&env);
        let merchant = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register(AuthorizationManager, ());
        let client = AuthorizationManagerClient::new(&env, &contract_id);

        client.initialize(&admin, &payment_engine);
        client.authorize(&user, &merchant, &token, &1000_i128, &12000_i128, &0_u64);

        // Revoke
        client.revoke(&user, &merchant, &token);

        // Verify revoked
        let auth = client.get_authorization(&user, &merchant, &token);
        assert!(auth.revoked);
    }

    #[test]
    fn test_record_payment() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payment_engine = Address::generate(&env);
        let user = Address::generate(&env);
        let merchant = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register(AuthorizationManager, ());
        let client = AuthorizationManagerClient::new(&env, &contract_id);

        client.initialize(&admin, &payment_engine);
        client.authorize(&user, &merchant, &token, &1000_i128, &12000_i128, &0_u64);

        // Record payment
        client.record_payment(&user, &merchant, &token, &1000_i128);

        // Verify total_spent updated
        let auth = client.get_authorization(&user, &merchant, &token);
        assert_eq!(auth.total_spent, 1000);
        assert_eq!(auth.payment_count, 1);
    }

    #[test]
    fn test_emergency_pause() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payment_engine = Address::generate(&env);
        let user = Address::generate(&env);
        let merchant = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register(AuthorizationManager, ());
        let client = AuthorizationManagerClient::new(&env, &contract_id);

        client.initialize(&admin, &payment_engine);

        // Pause contract
        client.pause();

        // Attempt authorize should fail (paused)
        let result =
            client.try_authorize(&user, &merchant, &token, &1000_i128, &12000_i128, &0_u64);
        assert!(result.is_err());

        // Unpause
        client.unpause();

        // Now authorize should work
        let result =
            client.try_authorize(&user, &merchant, &token, &1000_i128, &12000_i128, &0_u64);
        assert!(result.is_ok());
    }
}
