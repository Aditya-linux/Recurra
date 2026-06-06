# ErrorActionPreference removed to allow retries

# ============================================================
# RECURRA — MAINNET CONTRACT INITIALIZATION
# ============================================================

$PASSPHRASE = 'Public Global Stellar Network ; September 2015'
$RPC_URL = 'https://soroban-rpc.mainnet.stellar.gateway.fm'

# === FILL THESE IN FROM deploy_mainnet.ps1 OUTPUT ===
$DEPLOYER   = "GCHGS6MIBGAARREN7WSRNIOFSQ26V2P6GIYRDJQQMGEBJ2OT6VLRMFQ5"  # Your mainnet deployer public key
$AUTH       = "CACWOBHPPVOLHUHT6THO4P5T6UFXQYKTGK3JSASNNGHRFGOVD5FQPJ5I"  # CONTRACT_AUTHORIZATION_MANAGER address
$FACTORY    = "CBP3DPJXCSRU6AURUYC2WF6SGNEAB5ECMPBQY33SLTZOBUZJBRWHAQGN"  # CONTRACT_SUBSCRIPTION_FACTORY address
$ENGINE     = "CAT75XL6BB4EBI7JY4UDUIMPKBGSZZJRQFAFXK5C7OR7L6PHCVUL2MLU"  # CONTRACT_PAYMENT_ENGINE address
$TOKEN      = "CCVMU54F52KFE4MBI3NFE2CGLNXZWJZXD56ZFXMKCSAW3WW24CF5QX34"  # CONTRACT_TOKEN_WRAPPER address (USDC wrapper)
$ESCROW     = "CBVDOZZ323652WUXJQEPHZRLBSP7ZEHRU6VI6E7FSDO5LL2X26V6FSXE"  # CONTRACT_ESCROW_DISPUTE address
$FEE_RECIPIENT = "GCHGS6MIBGAARREN7WSRNIOFSQ26V2P6GIYRDJQQMGEBJ2OT6VLRMFQ5"  # Recurra treasury public key (receives 0.5% fee)

# Validate all addresses are filled
if (-not $DEPLOYER -or -not $AUTH -or -not $FACTORY -or -not $ENGINE -or -not $TOKEN -or -not $ESCROW -or -not $FEE_RECIPIENT) {
    Write-Host 'ERROR: You must fill in ALL contract addresses before running this script!' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Yellow
Write-Host '  RECURRA MAINNET INITIALIZATION' -ForegroundColor Yellow
Write-Host '  THIS USES REAL XLM — DOUBLE CHECK!' -ForegroundColor Red
Write-Host '========================================' -ForegroundColor Yellow
Write-Host ''

$confirm = Read-Host 'Type "INIT MAINNET" to proceed'
if ($confirm -ne 'INIT MAINNET') {
    Write-Host 'Aborted.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Step 1/5: Initializing Escrow...' -ForegroundColor Cyan
stellar contract invoke --id $ESCROW --source mainnet-deployer --rpc-url $RPC_URL --network-passphrase $PASSPHRASE -- initialize --admin $DEPLOYER
Write-Host 'Escrow initialized.' -ForegroundColor Green

Write-Host ''
Write-Host 'Step 2/5: Initializing Subscription Factory...' -ForegroundColor Cyan
stellar contract invoke --id $FACTORY --source mainnet-deployer --rpc-url $RPC_URL --network-passphrase $PASSPHRASE -- initialize --admin $DEPLOYER
Write-Host 'Factory initialized.' -ForegroundColor Green

Write-Host ''
Write-Host 'Step 3/5: Initializing Authorization Manager...' -ForegroundColor Cyan
stellar contract invoke --id $AUTH --source mainnet-deployer --rpc-url $RPC_URL --network-passphrase $PASSPHRASE -- initialize --admin $DEPLOYER --payment_engine $ENGINE
Write-Host 'Auth Manager initialized.' -ForegroundColor Green

Write-Host ''
Write-Host 'Step 4/5: Initializing Token Wrapper...' -ForegroundColor Cyan
stellar contract invoke --id $TOKEN --source mainnet-deployer --rpc-url $RPC_URL --network-passphrase $PASSPHRASE -- initialize --admin $DEPLOYER --payment_engine $ENGINE
Write-Host 'Token Wrapper initialized.' -ForegroundColor Green

Write-Host ''
Write-Host 'Step 5/5: Initializing Payment Engine...' -ForegroundColor Cyan
stellar contract invoke --id $ENGINE --source mainnet-deployer --rpc-url $RPC_URL --network-passphrase $PASSPHRASE -- initialize --admin $DEPLOYER --auth_manager $AUTH --sub_factory $FACTORY --token_wrapper $TOKEN --fee_recipient $FEE_RECIPIENT --fee_bps 50
Write-Host 'Payment Engine initialized (0.5% fee).' -ForegroundColor Green

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  ALL CONTRACTS INITIALIZED ON MAINNET!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
