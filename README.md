# Recurra (SurePay) - Web3 Recurring Payments

- **Live Demo:** [https://recurra-omega.vercel.app/](https://recurra-omega.vercel.app/)
- **Video Demo:** [https://drive.google.com/file/d/1XNMMoBTVS-vk5VoeOrIOehHYsTeokmZj/view?usp=sharing](https://drive.google.com/file/d/1KZiUOJZcZThXss8LVR6vYbEsdJ5dKjXN/view?usp=sharing)
- **Live User Registration & Feedback:** [View Registered Users Excel Sheet](https://docs.google.com/spreadsheets/d/1tuLzz7RhxH_Kpo3T9oExc2C6xBwJu_F0j6haewdmhC4/edit?usp=sharing)

Recurra is a decentralized B2B and B2C platform built on the Stellar Soroban smart contract network. It brings automated, recurring subscriptions to Web3, empowering merchants to create customizable subscription plans and allowing consumers to subscribe to services using their smart wallets seamlessly.

---

## The Problem it Solves

In the traditional Web2 world, recurring payments are simple: a user enters their credit card, and the merchant pulls funds automatically every month. 

In Web3, this is traditionally impossible. Smart contracts cannot self-execute, and cryptographic wallets require the user to explicitly sign a transaction every single time funds move. This means for a Web3 subscription, the user has to manually log in and sign a transaction every 30 days, resulting in massive churn and terrible user experience.

## The Recurra Solution

Recurra solves this by implementing a delegated allowance system coupled with an off-chain Keeper network. 
1. The user approves a one-time allowance to the Recurra smart contract.
2. The user signs a single transaction to initiate the subscription.
3. Our backend Keeper Node wakes up periodically to execute the process_payment function on the Soroban smart contract on behalf of the merchant, pulling the funds automatically based on the agreed-upon interval (e.g., 30 days).

## Target Audience

- **B2B (Merchants, DAOs, SaaS Providers, Creators):** Businesses that want to accept recurring crypto payments seamlessly without building their own smart contracts or indexing infrastructure.
- **B2C (Everyday Consumers):** Web3 users who want a unified Subscription Center to track, manage, and cancel their active subscriptions with a single click, paying directly from their self-custody wallets.

---

## System Architecture

Recurra is a full-stack Web3 application comprising three core layers:

### 1. Smart Contracts Layer (Rust / Soroban)
The backbone of the application deployed on the Stellar Testnet.
- **Payment Engine:** The core contract that handles the transfer of tokens from the Subscriber to the Merchant. It verifies that the required time interval has passed before allowing the backend Keeper to pull funds.
- **Security:** Uses Soroban's native require_auth to ensure users explicitly authorize the initial spending limits.

### 2. Backend Layer (Node.js / Express / PostgreSQL)
A high-performance backend that bridges the off-chain UI and the on-chain data.
- **Event Indexer:** A background worker that continuously polls the Stellar Horizon/RPC nodes for smart contract events. When an event happens on-chain, it instantly syncs the PostgreSQL database off-chain.
- **Keeper Node:** A background cron job that checks the database for subscriptions where the next payment time has passed. It constructs a Soroban transaction, pays the gas fee, and triggers the contract to process the next billing cycle.
- **Merchant API:** Endpoints for merchants to register, create plans, and configure webhooks.

### 3. Frontend Layer (React / Vite / Tailwind)
A premium, dark-mode, responsive user interface.
- **Merchant Dashboard (B2B):** Allows businesses to connect their Freighter wallet, register their business, define subscription plans, and view their revenue analytics.
- **Retail Storefront (B2C):** A consumer-facing marketplace where users can discover plans created by merchants, subscribe in one click, and manage their active recurring spending.

---

## Scalability and Future Infrastructure Plan

While the current MVP demonstrates the core mechanics of Web3 recurring billing, Recurra is designed with enterprise scale in mind. Future phases of the project will focus on global infrastructure migration to handle millions of transactions securely:

- **Cloud Provider Migration:** Containerize the Node.js backend using Docker and migrate to a managed Kubernetes service (e.g., AWS EKS or GCP GKE) for auto-scaling during high-traffic billing cycles.
- **Edge Network and CDN:** Implement AWS CloudFront or Cloudflare to cache frontend assets globally and provide ultra-low latency access for international users.
- **Security Architecture:** Deploy a Web Application Firewall (WAF) to mitigate DDoS attacks. Secure internal components by moving the PostgreSQL database and Redis clusters into private subnets, ensuring they are inaccessible from the public internet. Secrets like the Keeper Private Key will be migrated to AWS Secrets Manager.
- **Database Read Replicas:** Transition the PostgreSQL instance to a managed service like Amazon Aurora with geographically distributed read replicas (US, Europe, Asia) to minimize latency for the Event Indexer and Merchant Dashboard queries.
- **Automated Smart Contract Deployments:** Upgrade the backend to automatically build, sign, and submit Soroban deployments on the Stellar Mainnet whenever a new merchant creates a highly customized plan, completely removing manual intervention.

---

## User Flow: How it Works

1. **Merchant Onboarding:** A merchant connects their wallet, registers their business name, and creates a plan (e.g., 10 USDC every 30 days).
2. **Consumer Discovery:** A consumer browses the Retail Storefront on the frontend and clicks Subscribe on the merchant's plan.
3. **Smart Contract Approval:** The consumer's wallet (e.g., Freighter, Albedo, xBull) prompts them to sign the transaction, establishing the allowance and recording the subscription on the Soroban ledger.
4. **Automated Billing:** 30 days later, the Recurra backend Keeper detects the payment is due, pings the smart contract, and the funds are automatically routed from the consumer's wallet to the merchant's wallet. No user action required!

---

## Technical Setup & Installation

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- Rust & Soroban CLI (for smart contract development)
- Freighter Browser Extension (connected to Stellar Testnet)

### 1. Backend Setup
The backend serves the API and runs the blockchain Indexer.
```bash
cd backend
npm install

# 1. Duplicate the example environment file
cp .env.example .env

# 2. Update .env with your local PostgreSQL credentials and Keeper Key
# DATABASE_URL=postgresql://user:password@localhost:5432/recurra
# KEEPER_PRIVATE_KEY=YOUR_SECRET_KEY (Ensure this account is funded with XLM)

# 3. Start the backend server (runs on port 3001)
npm run dev
```

### 2. Frontend Setup
The frontend serves the React UI.
```bash
cd frontend
npm install

# 1. Duplicate the example environment file
cp .env.example .env

# 2. Start the Vite development server (runs on port 5173)
npm run dev
```

### 3. Smart Contracts (Optional)
If you wish to modify and redeploy the Rust smart contracts:
```bash
cd contracts/payment-engine

# Build the WebAssembly binary
cargo build --target wasm32-unknown-unknown --release

# Deploy to Stellar Testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/recurra_payment_engine.wasm \
  --source your-identity \
  --network testnet
```

---

## Project Structure

```text
├── backend/                  # Node.js/Express API & Workers
│   ├── src/api/              # REST Endpoints (merchants, users, plans)
│   ├── src/database/         # PostgreSQL Repositories
│   ├── src/services/         # Event Indexer & Business Logic
│   ├── src/keeper/           # Automated Payment Executor
│   └── package.json
├── contracts/                # Rust / Soroban Smart Contracts
│   ├── payment-engine/       # Core recurring billing logic
│   └── Cargo.toml
├── frontend/                 # React UI
│   ├── src/pages/            # Dashboard, Storefront, Merchant pages
│   ├── src/components/       # UI Components
│   ├── src/context/          # Global State & Wallet connection
│   └── package.json
└── README.md
```

## License
This project is licensed under the MIT License.
