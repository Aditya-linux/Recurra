# Recurra — User Guide

Welcome to **Recurra**, the first decentralized recurring payments platform on Stellar. This guide walks you through everything you need to get started — whether you're a **subscriber** paying for services or a **merchant** collecting recurring revenue.

---

## Table of Contents
1. [Getting Started (All Users)](#1-getting-started-all-users)
2. [For Subscribers](#2-for-subscribers)
3. [For Merchants](#3-for-merchants)
4. [Fee Sponsorship (Gasless Transactions)](#4-fee-sponsorship-gasless-transactions)
5. [FAQ](#5-faq)

---

## 1. Getting Started (All Users)

### Prerequisites
- A Stellar-compatible wallet (we recommend **Freighter** or **xBull**)
- Some **USDC** on Stellar mainnet for subscription payments
- A small amount of **XLM** for the initial wallet setup (if needed)

### Step 1: Install a Wallet
1. Go to [Freighter Wallet](https://www.freighter.app/) and install the browser extension
2. Create a new wallet or import an existing one
3. **Back up your recovery phrase** — store it securely offline

### Step 2: Fund Your Wallet
1. Purchase XLM on any exchange (Coinbase, Binance, etc.)
2. Send XLM to your Freighter wallet address
3. Swap XLM → USDC using [StellarX](https://www.stellarx.com/) or add the USDC trustline directly

### Step 3: Connect to Recurra
1. Visit [https://recurra-omega.vercel.app/](https://recurra-omega.vercel.app/)
2. Click **"Connect Wallet"** in the top-right corner
3. Approve the connection in your Freighter popup

---

## 2. For Subscribers

### Subscribing to a Plan

1. **Browse Plans** — On the homepage or a merchant's checkout page, view available subscription plans (e.g., "Premium Monthly — 10 USDC/month")
2. **Click Subscribe** — Select the plan you want
3. **Approve Allowance** — Your wallet will prompt you to approve a one-time token allowance to the Recurra smart contract. This does NOT transfer any funds yet — it simply gives the contract permission to pull your subscription amount each billing cycle
4. **Confirm Transaction** — Sign the transaction in your wallet
5. **Done!** — Your subscription is now active. You'll see a success confirmation with your subscription details

### How Billing Works
- **First payment** is charged immediately when you subscribe
- **Subsequent payments** are automatically collected by the Recurra Keeper at each billing interval (e.g., every 30 days)
- **You do NOT need to be online** — the Keeper handles everything in the background
- **Gas fees are sponsored** — the Recurra Keeper pays all network fees on your behalf (gasless!)

### Managing Your Subscriptions

#### View Active Subscriptions
Navigate to **My Subscriptions** in the dashboard to see:
- Active plans with next billing date
- Payment history and amounts
- Subscription status (Active, Paused, Cancelled)

#### Pause a Subscription
1. Go to **My Subscriptions**
2. Find the subscription you want to pause
3. Click **Pause** — billing stops immediately
4. You can resume anytime

#### Cancel a Subscription
1. Go to **My Subscriptions**
2. Click **Cancel** on the subscription
3. Confirm the cancellation in your wallet
4. No further payments will be collected

#### What Happens if My Balance is Low?
- If your USDC balance is too low when a payment is due, your subscription enters a **7-day grace period**
- You'll need to top up your wallet within 7 days
- If the payment remains uncollected after 7 days, the subscription is automatically cancelled

---

## 3. For Merchants

### Setting Up Your Merchant Account

1. **Connect your wallet** at [recurra-omega.vercel.app](https://recurra-omega.vercel.app/)
2. Navigate to the **Merchant Portal**
3. Fill in your business details:
   - Business name
   - Logo URL
   - Contact information
   - Payout wallet address

### Creating Subscription Plans

1. In the Merchant Portal, click **Create Plan**
2. Configure your plan:
   - **Plan Name** — e.g., "Pro Monthly"
   - **Price** — e.g., 10 USDC
   - **Billing Interval** — Monthly (30 days), Weekly (7 days), or custom
   - **Max Payments** — Set to 0 for unlimited, or a specific number for fixed-term plans
3. Click **Save** — your plan is now live

### Sharing Your Checkout Link
Each plan generates a unique checkout URL that you can share with customers:
```
https://recurra-omega.vercel.app/subscribe/<your-plan-id>
```

Embed this link in your website, email campaigns, or social media.

### Viewing Revenue & Analytics

The Merchant Dashboard shows:
- **Monthly Recurring Revenue (MRR)** — total active subscription revenue
- **Subscriber Growth** — new subscribers over time
- **Payment Distribution** — breakdown by plan
- **Transaction History** — every payment with on-chain transaction hash

### Payment Splitting
- **99.5%** of each payment goes directly to your wallet
- **0.5%** is a platform fee retained by the Recurra protocol

---

## 4. Fee Sponsorship (Gasless Transactions)

Recurra implements **Stellar Fee Bump Transactions** to make subscriptions completely gasless for subscribers.

### How It Works
1. When a payment is due, the Recurra **Keeper** builds a Soroban transaction
2. The transaction is wrapped in a **Fee Bump envelope** where the Keeper is the `feeSource`
3. The Keeper signs and submits the fee-bumped transaction
4. **Result:** The subscriber's wallet is charged ONLY the subscription amount (e.g., 10 USDC) — zero network fees

### Why This Matters
- Traditional Web3 apps require users to hold the native token (XLM) just to pay gas
- With Recurra, subscribers only need USDC — no XLM required for ongoing payments
- This removes friction and makes the experience identical to traditional credit card subscriptions

---

## 5. FAQ

### General

**Q: Is Recurra custodial?**  
A: No. Recurra is fully non-custodial. Your funds stay in your self-custody wallet at all times. The smart contract only pulls the exact subscription amount when it's due, based on the allowance you approved.

**Q: Which wallets are supported?**  
A: Freighter and xBull are the primary supported wallets. Any Stellar wallet that supports Soroban contract interactions should work.

**Q: What token do I pay with?**  
A: Currently, Recurra supports **USDC on Stellar mainnet**. Additional tokens may be added in the future.

### For Subscribers

**Q: Can the merchant charge more than I approved?**  
A: No. The smart contract enforces the exact amount specified in the plan. The merchant cannot change the amount after you subscribe.

**Q: What if I want to upgrade my plan?**  
A: Cancel your current subscription and subscribe to the new plan. Future versions will support seamless plan upgrades.

**Q: Do I need to be online for payments?**  
A: No. The Keeper automates everything — payments are processed even when you're offline.

### For Merchants

**Q: How quickly do I receive payments?**  
A: Payments are settled on-chain in ~5 seconds. There is no holding period — funds go directly to your Stellar wallet.

**Q: Can I offer discount codes?**  
A: Yes! The Merchant Portal supports creating discount codes with percentage or fixed-amount discounts.

**Q: How do I integrate Recurra into my website?**  
A: Share the checkout link for your plan. For deeper integration, use the Recurra REST API to programmatically create plans and manage subscriptions.

---

## Need Help?

- **Live App:** [https://recurra-omega.vercel.app/](https://recurra-omega.vercel.app/)
- **GitHub:** [https://github.com/Aditya-linux/Recurra](https://github.com/Aditya-linux/Recurra)
- **Technical Docs:** See the project [README.md](README.md) for developer setup
- **Security:** See the [Security Review](SECURITY_REVIEW.md) for architecture details
