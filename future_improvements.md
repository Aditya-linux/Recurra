# Future Updates & Improvements Checklist

Now that the core Stellar Mainnet deployment is live, here is a roadmap for future updates. This checklist is divided into **Architecture/Multi-chain**, **Frontend/UI Improvements**, and **Backend Resilience**.

## 🌐 1. Multi-Chain Expansion (EVM)
The goal here is to allow users on Ethereum, Polygon, or Arbitrum to pay subscriptions using their native EVM wallets (e.g., MetaMask), which then bridge to the Stellar backend.

- [ ] **EVM Smart Contracts:** Write a simple `Receiver` Solidity contract to accept recurring USDC payments on Polygon/Base.
- [ ] **Cross-Chain Messaging (CCIP / Axelar):** Integrate a bridging protocol to send a message from the EVM contract to the Stellar `Payment Engine` when a payment is received.
- [ ] **WalletConnect Integration:** Add wagmi/viem to the React frontend to support MetaMask, Rabby, and Coinbase Wallet.
- [ ] **Gas Sponsoring (Biconomy/Gelato):** Implement account abstraction (ERC-4337) so EVM users don't have to pay gas fees for every subscription pull.

## 🎨 2. UI / UX Improvements
To make the platform feel premium and build trust, the frontend needs a polish pass.

- [ ] **Dashboard Charts:** Add Recharts or Chart.js to the Merchant Dashboard to show MRR (Monthly Recurring Revenue) and Churn Rate over time.
- [ ] **Dark Mode Polish:** Ensure the dark mode theme is consistent, using modern glassmorphism (translucency + blur) on modals and cards.
- [ ] **Micro-Animations:** Add Framer Motion for smooth page transitions and success animations (e.g., when a subscription is confirmed).
- [ ] **Transaction History Timeline:** Build a visual "Timeline" view for users to see exactly when they were charged in the past and when the next charge is scheduled.
- [ ] **Toast Notifications:** Replace native browser alerts with custom, branded toast notifications (e.g., React Hot Toast).
- [ ] **Responsive Design Audit:** Thoroughly test the Checkout Widget on mobile viewports (iOS/Android) to ensure padding and touch targets are optimal.

## 🛡️ 3. Backend & Keeper Resilience
- [ ] **Mainnet Keeper Key:** Update the `KEEPER_PRIVATE_KEY` in production to a securely stored, funded Mainnet account.
- [ ] **Keeper Retry Logic:** Enhance the Cron job to handle temporary Soroban RPC outages gracefully (exponential backoff).
- [ ] **Alerting:** Integrate Datadog or Sentry to alert you immediately if a scheduled Keeper transaction fails on-chain.
- [ ] **Multi-Sig Admin:** Transfer ownership of the Soroban contracts from the single deployer key to a Multi-Sig wallet for enhanced security.
- [ ] **Fiat On-Ramp:** Integrate MoonPay or Transak so non-crypto users can pay for subscriptions using a credit card.

## 🌍 4. Global Infrastructure & Migration
Render is great for MVP, but to support high concurrency, ultra-low latency globally, and maximum security, the backend should be migrated to a dedicated cloud architecture.

- [ ] **Cloud Provider Migration:** Move from Render to AWS (Amazon Web Services) or GCP (Google Cloud) using a containerized architecture (Docker + Kubernetes or AWS Fargate) to automatically scale up when traffic spikes.
- [ ] **Edge Network & CDN:** Put Cloudflare or AWS CloudFront in front of the API and Frontend. This caches static assets globally and routes user requests to the nearest geographical server, ensuring fast load times everywhere.
- [ ] **Web Application Firewall (WAF):** Enable Cloudflare WAF or AWS WAF to block DDoS attacks, SQL injection, and malicious bot traffic before it even hits your servers.
- [ ] **Database Read Replicas:** Move the PostgreSQL database to a managed service like Amazon RDS with "Multi-AZ" and read replicas in different continents (e.g., US, Europe, Asia). This ensures that if a user in Tokyo fetches their subscriptions, it reads from an Asian database instantly rather than traveling to the US.
- [ ] **Private VPC & Secrets Manager:** Move all sensitive variables (like the Keeper private key) out of `.env` files and into AWS Secrets Manager or HashiCorp Vault. Ensure the database and Redis instances are in a Private Subnet (no public internet access) and can only be accessed by the backend servers.

---

> [!TIP]
> Keep this document updated as you build. When applying for grants, you can directly reference this checklist to show your future roadmap!
