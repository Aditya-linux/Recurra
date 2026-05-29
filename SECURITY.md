# Security Policy — Recurra

## Reporting Vulnerabilities

If you discover a security vulnerability, **DO NOT** open a public issue.

### Reporting Process
1. Email: **security@recurra.io** (or your designated security email)
2. Include: Description, reproduction steps, potential impact, suggested fix
3. We will acknowledge receipt within **24 hours**
4. Critical vulnerabilities will be patched within **24 hours**
5. High vulnerabilities will be patched within **72 hours**

### Bug Bounty Program
We maintain a bug bounty program on Immunefi:
- **Critical:** $50,000 (e.g., unauthorized fund transfers, contract draining)
- **High:** $20,000 (e.g., bypass authorization, keeper key compromise)
- **Medium:** $5,000 (e.g., denial of service, data exposure)

## Security Architecture — 5-Layer Defense in Depth

### Layer 1: Smart Contract Security
- Reentrancy guards (Checks-Effects-Interactions pattern)
- Integer overflow protection (`checked_add`, `saturating_sub`)
- Access control (`require_auth()` on all sensitive functions)
- Timelock upgrades (48-hour delay, multi-sig required)
- Atomic operations (all-or-nothing transactions)
- Emergency pause function
- Idempotency (payment_number prevents double execution)

### Layer 2: Wallet & Key Security
- Hardware wallet support (Ledger/Trezor for admin keys)
- Multi-signature admin keys (2-of-3)
- AWS KMS / HashiCorp Vault for private keys
- Session key limits (24-hour expiry, $50 spending cap)

### Layer 3: API & Backend Security
- Rate limiting (100 req/min per IP, 1000/min per API key)
- JWT with 15-min expiry + refresh token rotation
- HMAC-SHA256 webhook signing
- Zod input validation on all endpoints
- CORS policy (allowed origins only)

### Layer 4: Infrastructure Security
- VPC with private subnets
- Web Application Firewall (OWASP Top 10)
- DDoS protection
- Container scanning for CVEs
- Encrypted logs (AES-256)

### Layer 5: Operational Security
- Professional security audit (OtterSec/CertiK)
- Quarterly penetration testing
- Incident response runbook
- Insurance fund (2% of payments, multi-sig governed)

## Incident Response Levels

| Level | Description | Response Time | Example |
|-------|------------|---------------|---------|
| Level 1 | Informational | 24 hours | Suspicious log pattern |
| Level 2 | Service degradation | 4 hours | Keeper delays, API slowdown |
| Level 3 | Critical incident | 1 hour | Fund at risk, contract exploit |

## Responsible Disclosure

We follow a 90-day responsible disclosure policy. Researchers who report valid vulnerabilities will be credited (with permission) in our security advisories.
