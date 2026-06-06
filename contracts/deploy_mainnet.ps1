$ErrorActionPreference = 'Stop'

$PASSPHRASE = 'Public Global Stellar Network ; September 2015'
$RPC_URL = 'https://soroban-rpc.mainnet.stellar.gateway.fm'
$TIMESTAMP = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$OUTPUT_FILE = "mainnet_addresses_$TIMESTAMP.txt"

Write-Host '========================================' -ForegroundColor Yellow
Write-Host '  RECURRA MAINNET DEPLOYMENT (RESUME)' -ForegroundColor Yellow
Write-Host '  Deploying remaining 3 contracts' -ForegroundColor Yellow
Write-Host '========================================' -ForegroundColor Yellow

$confirm = Read-Host 'Type "RESUME MAINNET" to proceed'
if ($confirm -ne 'RESUME MAINNET') {
    Write-Host 'Aborted.' -ForegroundColor Red
    exit 1
}

# Already deployed to save XLM
$FACTORY = 'CBP3DPJXCSRU6AURUYC2WF6SGNEAB5ECMPBQY33SLTZOBUZJBRWHAQGN'
$ENGINE = 'CAT75XL6BB4EBI7JY4UDUIMPKBGSZZJRQFAFXK5C7OR7L6PHCVUL2MLU'
Write-Host "FACTORY (Already Deployed) = $FACTORY" -ForegroundColor Yellow
Write-Host "ENGINE (Already Deployed) = $ENGINE" -ForegroundColor Yellow

Write-Host 'Deploying Authorization Manager...' -ForegroundColor Cyan
$AUTH = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_authorization.wasm --source mainnet-deployer --rpc-url $RPC_URL --network-passphrase $PASSPHRASE
Write-Host "AUTH = $AUTH" -ForegroundColor Green

Write-Host 'Deploying Token Wrapper...' -ForegroundColor Cyan
$TOKEN = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_token_wrapper.wasm --source mainnet-deployer --rpc-url $RPC_URL --network-passphrase $PASSPHRASE
Write-Host "TOKEN = $TOKEN" -ForegroundColor Green

Write-Host 'Deploying Escrow...' -ForegroundColor Cyan
$ESCROW = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_escrow.wasm --source mainnet-deployer --rpc-url $RPC_URL --network-passphrase $PASSPHRASE
Write-Host "ESCROW = $ESCROW" -ForegroundColor Green

$lines = @(
    '# MAINNET CONTRACT ADDRESSES',
    "CONTRACT_AUTHORIZATION_MANAGER=$AUTH",
    "CONTRACT_SUBSCRIPTION_FACTORY=$FACTORY",
    "CONTRACT_PAYMENT_ENGINE=$ENGINE",
    "CONTRACT_TOKEN_WRAPPER=$TOKEN",
    "CONTRACT_ESCROW_DISPUTE=$ESCROW",
    'USDC_TOKEN_ADDRESS=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI'
)

$lines | Out-File -FilePath $OUTPUT_FILE -Encoding ascii

Write-Host '========================================' -ForegroundColor Green
Write-Host '  ALL 5 CONTRACTS ARE NOW ON MAINNET!' -ForegroundColor Green
Write-Host "  Addresses saved to: $OUTPUT_FILE" -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
