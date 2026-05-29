$ErrorActionPreference = "Stop"

Write-Host "Deploying Subscription Factory..."
$factory = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_subscription_factory.wasm --source deployer --network testnet --network-passphrase "Test SDF Network ; September 2015"
Write-Host "FACTORY=$factory"

Write-Host "Deploying Payment Engine..."
$engine = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_payment_engine.wasm --source deployer --network testnet --network-passphrase "Test SDF Network ; September 2015"
Write-Host "ENGINE=$engine"

Write-Host "Deploying Token Wrapper..."
$token = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_token_wrapper.wasm --source deployer --network testnet --network-passphrase "Test SDF Network ; September 2015"
Write-Host "TOKEN=$token"

Write-Host "Deploying Escrow..."
$escrow = stellar contract deploy --wasm target/wasm32-unknown-unknown/release/recurra_escrow.wasm --source deployer --network testnet --network-passphrase "Test SDF Network ; September 2015"
Write-Host "ESCROW=$escrow"
