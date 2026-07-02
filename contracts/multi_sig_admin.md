# Multi-Sig Admin Guide

For enhanced security in production, ownership of the Recurra smart contracts must be transferred to a Multi-Sig (Multi-Signature) wallet. This ensures that no single point of failure can upgrade or modify the contract state maliciously.

## Setting Up a Multi-Sig Account on Stellar

On Stellar, any account can become a multi-sig account by adding additional signers and adjusting the threshold weights.

1. **Create the Admin Account:** This is the primary account that deployed the contract.
2. **Add Signers:** Add public keys of trusted team members as signers to this account using the `SetOptions` operation.
3. **Set Thresholds:**
   - **Low/Med/High Thresholds:** Set these to a value that requires multiple signatures. For example, if you add 3 signers with weight 1, you can set the High Threshold to 2 (requiring 2 out of 3 signatures to upgrade the contract).

### Example: Soroban CLI / Stellar SDK

Using the Stellar SDK (JavaScript/TypeScript):

```javascript
import { TransactionBuilder, Networks, Operation } from '@stellar/stellar-sdk';

// The current Admin Account
const sourceAccount = await server.getAccount(adminPublicKey);

// Build transaction to add a signer and set thresholds
const tx = new TransactionBuilder(sourceAccount, {
  fee: '100',
  networkPassphrase: Networks.PUBLIC,
})
.addOperation(Operation.setOptions({
  signer: {
    ed25519PublicKey: 'GC...NEW_SIGNER_KEY',
    weight: 1,
  },
  masterWeight: 1,
  lowThreshold: 0,
  medThreshold: 2, // 2 out of 3 required for most ops
  highThreshold: 2, // 2 out of 3 required for contract upgrades
}))
.setTimeout(30)
.build();

// Sign and submit with the current admin key
tx.sign(adminKeypair);
await server.submitTransaction(tx);
```

## Transferring Contract Ownership

If your contract implements a custom `admin` variable in its storage (often initialized during `init`), you must call the `transfer_ownership` (or similar) function on your Soroban contract to point to the new Multi-Sig account address.

1. **Deploy Contract:** Deployed by the original deployer account.
2. **Setup Multi-Sig:** Convert the deployer account into a multi-sig account as described above.
3. **Future Upgrades:** Any future `stellar-cli contract upgrade` commands will yield an XDR that must be signed by multiple parties before submission.

## Best Practices

1. **Geographic Distribution:** Signers should be geographically distributed.
2. **Hardware Wallets:** All signers should use hardware wallets (e.g., Ledger) or institutional custody providers.
3. **Keeper Key Isolation:** The `KEEPER_PRIVATE_KEY` used in the backend should **NOT** have admin privileges. It should be a dedicated account with only enough XLM to pay for gas fees, and its public key should be explicitly authorized by the contract merely to execute `process_payment`, without permission to upgrade or drain funds.
