$ErrorActionPreference = "Stop"

$PASSPHRASE = "Test SDF Network ; September 2015"

Write-Host "Deploying Authorization..."
$AUTH = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_authorization.wasm --source deployer --network testnet --network-passphrase $PASSPHRASE
Write-Host "AUTH = $AUTH"

Write-Host "Deploying Subscription Factory..."
$FACTORY = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_subscription_factory.wasm --source deployer --network testnet --network-passphrase $PASSPHRASE
Write-Host "FACTORY = $FACTORY"

Write-Host "Deploying Payment Engine..."
$ENGINE = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_payment_engine.wasm --source deployer --network testnet --network-passphrase $PASSPHRASE
Write-Host "ENGINE = $ENGINE"

Write-Host "Deploying Token Wrapper..."
$TOKEN = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_token_wrapper.wasm --source deployer --network testnet --network-passphrase $PASSPHRASE
Write-Host "TOKEN = $TOKEN"

Write-Host "Deploying Escrow..."
$ESCROW = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_escrow.wasm --source deployer --network testnet --network-passphrase $PASSPHRASE
Write-Host "ESCROW = $ESCROW"
