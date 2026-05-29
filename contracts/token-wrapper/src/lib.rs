//! # Recurra Token Wrapper
//!
//! Thin wrapper around standard Soroban token contracts (USDC, XLM)
//! adding subscription-specific features like batch transfers for keeper efficiency.
//!
//! ## Security
//! - All transfers require sender authentication
//! - Batch transfers are atomic (all-or-nothing)
//! - Admin-only configuration functions

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, log, token, Address, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TokenError {
    /// Transfer failed
    TransferFailed = 1,
    /// Insufficient balance
    InsufficientBalance = 2,
    /// Unauthorized caller
    Unauthorized = 3,
    /// Contract not initialized
    NotInitialized = 4,
    /// Contract is paused
    Paused = 5,
    /// Invalid amount
    InvalidAmount = 6,
    /// Batch too large
    BatchTooLarge = 7,
    /// Overflow
    Overflow = 8,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    /// Payment Engine address (authorized for batch operations)
    PaymentEngine,
    /// Total transfer volume tracked
    TotalVolume,
    /// Total transfers count
    TotalTransfers,
}

/// A single transfer in a batch
#[contracttype]
#[derive(Clone, Debug)]
pub struct TransferRequest {
    pub token: Address,
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

/// Result of a batch transfer
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchResult {
    pub successful: u32,
    pub total: u32,
}

/// Maximum batch size to prevent gas exhaustion
const MAX_BATCH_SIZE: u32 = 50;

#[contract]
pub struct TokenWrapperContract;

#[contractimpl]
impl TokenWrapperContract {
    pub fn initialize(env: Env, admin: Address, payment_engine: Address) -> Result<(), TokenError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(TokenError::Unauthorized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PaymentEngine, &payment_engine);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::TotalVolume, &0_i128);
        env.storage()
            .instance()
            .set(&DataKey::TotalTransfers, &0_u64);
        env.storage().instance().extend_ttl(100, 500_000);
        log!(&env, "Token Wrapper initialized");
        Ok(())
    }

    /// Execute a single token transfer.
    ///
    /// # Security
    /// - Requires sender (from) authentication
    /// - Validates amount > 0
    /// - Delegates to underlying Soroban token contract
    pub fn transfer(
        env: Env,
        token_address: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        Self::check_not_paused(&env)?;

        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }

        from.require_auth();

        // Execute transfer via Soroban token interface
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&from, &to, &amount);

        // Track stats
        Self::update_stats(&env, amount);

        log!(&env, "Transfer: {} -> {}, amount={}", from, to, amount);
        Ok(())
    }

    /// Check token balance for an account.
    pub fn balance_of(env: Env, token_address: Address, account: Address) -> i128 {
        let token_client = token::Client::new(&env, &token_address);
        token_client.balance(&account)
    }

    /// Check token allowance.
    pub fn allowance(env: Env, token_address: Address, owner: Address, spender: Address) -> i128 {
        let token_client = token::Client::new(&env, &token_address);
        token_client.allowance(&owner, &spender)
    }

    /// Execute multiple transfers in a single transaction (atomic).
    /// Used by the keeper service for batch payment processing.
    ///
    /// # Security
    /// - Only callable by the Payment Engine
    /// - All transfers are atomic (all succeed or all fail)
    /// - Maximum batch size enforced
    pub fn batch_transfer(
        env: Env,
        transfers: Vec<TransferRequest>,
    ) -> Result<BatchResult, TokenError> {
        Self::check_not_paused(&env)?;

        // Only Payment Engine can batch
        let pe: Address = env
            .storage()
            .instance()
            .get(&DataKey::PaymentEngine)
            .ok_or(TokenError::NotInitialized)?;
        pe.require_auth();

        let total = transfers.len();
        if total > MAX_BATCH_SIZE {
            return Err(TokenError::BatchTooLarge);
        }

        let mut total_amount: i128 = 0;

        // Execute all transfers atomically
        for i in 0..total {
            let req = transfers.get(i).unwrap();

            if req.amount <= 0 {
                return Err(TokenError::InvalidAmount);
            }

            let token_client = token::Client::new(&env, &req.token);
            token_client.transfer(&req.from, &req.to, &req.amount);

            total_amount = total_amount
                .checked_add(req.amount)
                .ok_or(TokenError::Overflow)?;
        }

        Self::update_stats(&env, total_amount);

        log!(
            &env,
            "Batch transfer: {} transfers, total={}",
            total,
            total_amount
        );
        Ok(BatchResult {
            successful: total,
            total,
        })
    }

    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    pub fn pause(env: Env) -> Result<(), TokenError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), TokenError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    pub fn stats(env: Env) -> (i128, u64) {
        let volume: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalVolume)
            .unwrap_or(0);
        let count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalTransfers)
            .unwrap_or(0);
        (volume, count)
    }

    // --------------------------------------------------------
    // INTERNAL
    // --------------------------------------------------------

    fn check_not_paused(env: &Env) -> Result<(), TokenError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(TokenError::Paused);
        }
        Ok(())
    }

    fn update_stats(env: &Env, amount: i128) {
        let vol: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalVolume)
            .unwrap_or(0);
        env.storage().instance().set(
            &DataKey::TotalVolume,
            &vol.checked_add(amount).unwrap_or(vol),
        );
        let count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalTransfers)
            .unwrap_or(0);
        env.storage().instance().set(
            &DataKey::TotalTransfers,
            &count.checked_add(1).unwrap_or(count),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let pe = Address::generate(&env);

        let contract_id = env.register_contract(None, TokenWrapperContract);
        let client = TokenWrapperContractClient::new(&env, &contract_id);

        client.initialize(&admin, &pe);

        let (vol, count) = client.stats();
        assert_eq!(vol, 0);
        assert_eq!(count, 0);
    }
}
