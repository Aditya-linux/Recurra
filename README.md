# Recurra (SurePay) - Web3 Recurring Payments on Stellar Soroban

Recurra is a decentralized B2B & B2C platform built on the Stellar Soroban smart contract network. It allows merchants to deploy subscription models and empowers consumers to subscribe to services using their Web3 smart wallets.

## Features
- **B2B Merchant Portal**: Merchants can register, deploy payment receivers, and create custom subscription plans.
- **B2C Retail Store**: Consumers can browse available subscriptions across all merchants and subscribe in one click.
- **Soroban Smart Contracts**: Trustless subscription orchestration, footprint calculation, and token allowances.
- **High-Performance Indexer**: A backend worker that listens to the Stellar Testnet for `PaymentExecuted` and `SubscriptionCreated` events to sync off-chain Postgres databases.

## Tech Stack
- **Smart Contracts**: Rust & Soroban SDK
- **Backend**: Node.js, Express, TypeScript, PostgreSQL, `@stellar/stellar-sdk`
- **Frontend**: React, TypeScript, Vite, Tailwind CSS (via custom styling), Freighter Wallet Integration

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL
- Rust & Soroban CLI
- Freighter Browser Extension (connected to Testnet)

### 2. Smart Contracts
```bash
cd contracts/payment-engine
cargo build --target wasm32-unknown-unknown --release
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_payment_engine.wasm --source your-identity --network testnet
```

### 3. Backend Setup
```bash
cd backend
npm install
cp .env.example .env # Fill in your DB credentials and Soroban Contract IDs
npm run dev
```

### 4. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env # Fill in your API base URL
npm run dev
```

## License
MIT
