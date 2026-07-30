# How I Built Gasless Recurring Payments on Stellar with Soroban

> A technical deep-dive into building Recurra — a decentralized subscription billing engine using Stellar smart contracts, fee bump transactions, and an off-chain Keeper architecture.

---

## Introduction

Recurring payments are the backbone of modern SaaS — Netflix, Spotify, and every subscription service depends on them. In Web2, it's simple: a user enters their credit card once, and the merchant pulls funds automatically every month.

In Web3, this is fundamentally broken. Smart contracts can't self-execute, and crypto wallets require the user to manually sign every transaction. Imagine asking your Netflix subscribers to open their wallet and click "Approve" every 30 days. The churn would be catastrophic.

I built **Recurra** to solve this problem on Stellar. This article explains the architecture, the security challenges, and how I used Stellar's native **Fee Bump Transactions** to make the entire experience gasless for end-users.

## Architecture Overview

Recurra uses a hybrid on-chain/off-chain architecture with three core components:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│  Soroban Smart   │◀────│   Keeper Node   │
│  (React/TS)  │     │    Contracts     │     │  (Node.js/TS)   │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │                        │
                    ┌──────┴──────┐          ┌──────┴──────┐
                    │  Stellar    │          │  PostgreSQL  │
                    │  Mainnet    │          │  + Redis     │
                    └─────────────┘          └─────────────┘
```

### The Flow

1. **Subscribe**: User connects their Stellar wallet (Freighter/xBull) and approves a one-time token allowance to the Recurra smart contract
2. **First Payment**: The smart contract immediately collects the first payment
3. **Automation**: 30 days later, the off-chain **Keeper Node** wakes up, checks the database for due subscriptions, and calls `execute_payment` on the Soroban contract
4. **Gasless**: The Keeper wraps every transaction in a **Fee Bump envelope**, paying all network fees so subscribers pay $0 in gas

The user doesn't need to be online. The Keeper handles everything.

## Smart Contract: The Payment Engine

The core contract is written in Rust using the Soroban SDK. Here's the critical design decision — the **Checks-Effects-Interactions (CEI) pattern**:

```rust
pub fn execute_payment(
    env: Env,
    subscription_id: String,
) -> Result<PaymentExecutedEvent, PaymentError> {
    // --- CHECKS ---
    // 1. Load subscription from storage
    // 2. Validate timing (is payment due?)
    // 3. Validate status (is subscription active?)
    // 4. Check idempotency key

    // --- EFFECTS ---
    // 5. Update payments_made counter
    // 6. Advance next_payment_time
    // 7. Mark idempotency key as used
    // 8. Save updated subscription to storage

    // --- INTERACTIONS ---
    // 9. Transfer tokens: user → merchant (99.5%)
    // 10. Transfer tokens: user → treasury (0.5% fee)
}
```

### Why CEI Matters

If you update state *after* the token transfer, a malicious token contract could re-enter your function and trigger a second payment before the first one is recorded. By updating state (step 5-8) *before* the transfers (step 9-10), we guarantee:

- **No re-entrancy**: State is already updated when the external call happens
- **No double-charge**: The idempotency key is set before the transfer
- **Atomicity**: If either transfer fails, Soroban reverts the entire transaction (including state changes)

### Idempotency

Every payment is uniquely identified by `(subscription_id, payment_number)`:

```rust
let idempotency_key = DataKey::PaymentExecuted(subscription_id, next_payment_num);
if env.storage().persistent().has(&idempotency_key) {
    return Err(PaymentError::PaymentAlreadyExecuted);
}
```

Even if the Keeper crashes and retries, or if multiple Keeper instances run simultaneously, no user will ever be double-charged.

## Fee Sponsorship: Making It Gasless

This was the most impactful feature. Traditional Web3 apps require users to hold the native token (XLM on Stellar) just to pay gas fees. For a subscription product, this is a terrible UX — users just want to pay their 10 USDC monthly subscription, not worry about gas.

Stellar has a native solution: **Fee Bump Transactions**.

### How Fee Bump Works

```typescript
// 1. Build the inner transaction (the actual contract call)
const innerTx = new TransactionBuilder(keeperAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
})
.addOperation(Operation.invokeHostFunction({
    func: { type: 'invokeContract', contractAddress, functionName: 'execute_payment', args: [...] },
    auth: [],
}))
.setTimeout(30)
.build();

innerTx.sign(keeperKeypair);

// 2. Wrap in a Fee Bump — Keeper pays ALL fees
const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
    keeperKeypair,       // feeSource — Keeper pays gas
    '10000000',          // maxFee — up to 1 XLM
    innerTx,             // the actual payment call
    Networks.PUBLIC
);

feeBumpTx.sign(keeperKeypair);

// 3. Submit — subscriber pays $0 in network fees
await rpcServer.sendTransaction(feeBumpTx);
```

The `feeSource` in the fee bump envelope is the Keeper's account. The subscriber's wallet is only debited the subscription amount (e.g., 10 USDC). No XLM needed.

## The Keeper: Off-Chain Automation

The Keeper is a Node.js service that runs on a cron schedule:

1. **Scheduler** (node-cron): Triggers every 15 minutes
2. **Scanner**: Queries PostgreSQL for subscriptions where `next_payment_time <= NOW()`
3. **Queue** (BullMQ + Redis): Enqueues each due payment as a job with deduplication
4. **Worker**: Processes jobs with retry logic (exponential backoff: 5s → 25s → 125s)
5. **Fee Sponsor**: Wraps each transaction in a fee bump envelope

### Distributed Locking

If you deploy multiple Keeper instances for high availability, you need to prevent them from processing the same payment twice. We use Redis-based distributed locks:

```typescript
const lock = new RedisLock('keeper:scan_due_payments', 120); // 2-minute TTL
const acquired = await lock.acquire();
if (!acquired) return; // Another instance is already scanning
```

Combined with the on-chain idempotency key, this gives us **two layers of double-charge prevention**.

## Security: CI/CD Pipeline

Every push triggers:
- **Rust**: `cargo test` + `cargo clippy -- -D warnings` + `cargo fmt --check`
- **TypeScript**: `tsc --noEmit` + ESLint + Jest
- **Vulnerability Scanning**: Trivy (filesystem scan for CRITICAL/HIGH CVEs) + `npm audit`
- **Docker**: Production image build validation

## Lessons Learned

1. **CEI pattern is non-negotiable** for financial contracts. Always update state before external calls.
2. **Fee Bump Transactions** are Stellar's killer feature for consumer apps. No other chain has native fee sponsorship this clean.
3. **Idempotency must be enforced at every layer** — on-chain (contract storage), off-chain (job queue deduplication), and infrastructure (distributed locks).
4. **Soroban's ACID guarantees** simplify atomic fee splitting. If any part of the transaction fails, everything reverts.

## Try It Out

- **Live App**: [https://recurra-omega.vercel.app/](https://recurra-omega.vercel.app/)
- **GitHub**: [https://github.com/Aditya-linux/Recurra](https://github.com/Aditya-linux/Recurra)
- **Smart Contract (Rust)**: [Payment Engine source](https://github.com/Aditya-linux/Recurra/blob/main/contracts/payment-engine/src/lib.rs)

Built on Stellar 🚀

---

*Tags: #Stellar #Soroban #Web3 #SmartContracts #Rust #RecurringPayments #FeeBump #DeFi*
