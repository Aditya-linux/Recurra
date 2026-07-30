# Recurra — Security Review Report

**Project:** Recurra — Web3 Recurring Payments Platform  
**Date:** July 2026  
**Reviewer:** Internal Security Review (Self-Audit)  
**Scope:** Smart contracts, backend infrastructure, CI/CD pipeline, dependency management  

---

## Executive Summary

Recurra is a production-grade recurring payment engine on Stellar Soroban. This document covers the security architecture, threat mitigations, and ongoing security processes implemented across the full stack.

**Overall Risk Assessment: LOW-MEDIUM**  
The platform follows industry best practices for smart contract security (CEI pattern), infrastructure isolation, and automated vulnerability scanning.

---

## 1. Smart Contract Security

### 1.1 Checks-Effects-Interactions (CEI) Pattern
All Soroban contracts follow the **CEI pattern** to prevent re-entrancy attacks:
1. **CHECKS** — Validate all inputs and preconditions
2. **EFFECTS** — Update on-chain state BEFORE external calls
3. **INTERACTIONS** — Execute token transfers LAST

**Reference:** [`payment-engine/src/lib.rs` — Lines 338–494](contracts/payment-engine/src/lib.rs)

### 1.2 Idempotency (Double-Charge Prevention)
Every payment execution is tracked by an idempotency key: `(subscription_id, payment_number)`. If a duplicate call is made, the contract returns `PaymentAlreadyExecuted` error.

```rust
// Before executing any transfer:
let idempotency_key = DataKey::PaymentExecuted(subscription_id, next_payment_num);
if env.storage().persistent().has(&idempotency_key) {
    return Err(PaymentError::PaymentAlreadyExecuted);
}
```

### 1.3 Access Control
- **Admin functions** (`pause`, `unpause`, `add_keeper`, `update_fee`) require `admin.require_auth()`
- **User functions** (`create_subscription`, `cancel_subscription`) require `user.require_auth()`
- **Merchant functions** (`merchant_claim_payment`) require `merchant.require_auth()` + ownership verification
- **Keeper payments** are open (anyone can call `execute_payment`) but the contract enforces timing and idempotency

### 1.4 Input Validation
- Payment amounts must be > 0
- Intervals must be ≥ 3600 seconds (1 hour minimum)
- Fee BPS is capped at 1000 (10% maximum)
- User subscriptions are capped at 100 per account (`MAX_USER_SUBSCRIPTIONS`)

### 1.5 Grace Period & Auto-Expiry
Failed payments enter a 7-day grace period (`GRACE_PERIOD_SECONDS = 604,800`). If the grace period lapses without successful payment, the subscription is automatically cancelled on-chain.

### 1.6 Overflow Protection
All arithmetic operations use Rust's `checked_add` to prevent integer overflow:
```rust
let new_counter = counter.checked_add(1).ok_or(PaymentError::Overflow)?;
```

### 1.7 Atomic Fee Splitting
Protocol fees (0.5%) are split atomically within a single Soroban transaction. If either the merchant transfer or the fee transfer fails, the **entire transaction reverts** (Soroban's ACID guarantee).

---

## 2. Backend Infrastructure Security

### 2.1 Keeper Key Isolation
- The Keeper private key is stored in environment variables (Render Dashboard secret store)
- The Keeper account is a **dedicated, low-privilege account** with only enough XLM to pay gas
- The Keeper has NO admin privileges on the smart contracts
- **Production recommendation:** Migrate to AWS KMS or HashiCorp Vault for key management

### 2.2 Distributed Locking (No Double Processing)
The Keeper uses Redis-backed distributed locks (`RedisLock`) to prevent multiple server instances from processing the same payment batch simultaneously.

```typescript
const lock = new RedisLock('keeper:scan_due_payments', 120); // 2 minute TTL
const acquired = await lock.acquire();
if (!acquired) return; // Another instance is already processing
```

### 2.3 Job Queue with Backoff
Payment jobs are queued via BullMQ with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 5 seconds
- Attempt 3: 25 seconds
- Attempt 4: 125 seconds

Failed jobs are retained for 7 days for debugging.

### 2.4 Rate Limiting
- API rate limiting via `express-rate-limit`: 100 requests/minute per IP
- Keeper worker rate limiting: 10 jobs/second maximum
- Queue backlog alerting at 1000+ waiting jobs

### 2.5 Request Security Headers
The backend uses `helmet` middleware for secure HTTP headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- XSS protection via `xss-clean`

### 2.6 Authentication
- JWT-based authentication with 15-minute access tokens and 7-day refresh tokens
- Passwords hashed with `bcryptjs`
- Input validation via `zod` schemas

### 2.7 CORS Configuration
Strict CORS allowlist limited to:
- `http://localhost:3000` (development)
- `http://localhost:5173` (Vite dev server)
- `https://recurra-omega.vercel.app` (production frontend)

---

## 3. CI/CD Security Pipeline

### 3.1 Automated Security Scanning
The GitHub Actions pipeline (`.github/workflows/ci.yml`) includes:

| Stage | Tool | What It Checks |
|---|---|---|
| Smart Contract Lint | `cargo clippy -- -D warnings` | Rust code quality, unsafe patterns |
| Smart Contract Format | `cargo fmt --all -- --check` | Consistent formatting |
| Backend Lint | ESLint with TypeScript rules | Code quality, type safety |
| Dependency Audit | `npm audit --audit-level=high` | Known CVEs in npm packages |
| Filesystem Scan | **Trivy** (aquasecurity) | CRITICAL and HIGH vulnerabilities across all files |
| Docker Build | `docker build` | Validates container builds without secrets |

### 3.2 Vulnerability Remediation History
- **CVE-2026-12143** (ws): Fixed in commit `09eecc0` — updated `ws` to `^8.21.0`
- **CVE-2026-48779** (form-data): Fixed in commit `26c508a` — updated `form-data` to `^4.0.6`

### 3.3 Permissions
CI pipeline runs with minimal permissions:
```yaml
permissions:
  contents: read
  packages: write
```

---

## 4. Smart Contract Test Coverage

### 4.1 Soroban Tests (Rust)
| Test | What It Validates |
|---|---|
| `test_create_and_execute_subscription` | Full lifecycle: create → execute → verify state |
| `test_cancel_subscription` | User-initiated cancellation sets status to `Cancelled` |
| `test_idempotency` | Duplicate `execute_payment` calls are rejected |

### 4.2 Backend Tests (Jest)
| Test | What It Validates |
|---|---|
| `KeeperService — Redis available` | Queue initializes, stats are zeroed |
| `KeeperService — Redis unavailable` | Graceful degradation, no queue instantiated |

---

## 5. Threat Model

| Threat | Mitigation | Status |
|---|---|---|
| Re-entrancy attack | CEI pattern — state updated before transfers | ✅ Mitigated |
| Double-charge | Idempotency keys `(sub_id, payment_num)` | ✅ Mitigated |
| Keeper key compromise | Dedicated low-privilege account, no admin rights | ✅ Mitigated |
| DDoS on API | Rate limiting (100 req/min/IP), Helmet headers | ✅ Mitigated |
| Supply chain attack | Trivy scanning + npm audit in CI | ✅ Mitigated |
| Integer overflow | Rust `checked_add` on all counters | ✅ Mitigated |
| Unauthorized admin access | `require_auth()` on all admin functions | ✅ Mitigated |
| Multi-instance double processing | Redis distributed locks | ✅ Mitigated |
| Expired subscription abuse | Grace period auto-expiry (7 days) | ✅ Mitigated |
| Fee manipulation | Fee BPS capped at 1000 (10% max), admin-only | ✅ Mitigated |

---

## 6. Recommendations for Future Hardening

1. **Migrate Keeper key to AWS KMS / HashiCorp Vault** — eliminates `.env` key exposure risk
2. **Add Multi-Sig admin** — prevents single-point-of-failure for contract upgrades (documented in `contracts/multi_sig_admin.md`)
3. **Integrate Sentry/Datadog alerting** — real-time alerts for failed Keeper transactions
4. **Web Application Firewall (WAF)** — Cloudflare or AWS WAF for DDoS protection at the edge
5. **Formal smart contract audit** — engage a third-party auditor (e.g., OtterSec, Halborn) for independent review

---

## 7. Conclusion

Recurra implements defense-in-depth security across all layers. The Soroban smart contracts follow the CEI pattern with idempotency protection, the backend uses distributed locks and rate limiting, and the CI/CD pipeline includes automated vulnerability scanning with Trivy.

The platform is production-ready for its current scale. As user volume grows beyond 1000+ subscribers, the recommendations in Section 6 should be prioritized.
