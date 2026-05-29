$ErrorActionPreference = "Stop"

$DEPLOYER = "GB3DJRW7V3NRNLLJU7D3YBEAFFRMXORVC55QRFXBG2E5PD4GPFNYS5BW"
$AUTH = "CBHPRCHV7XZZZQW4UUI6V3LACVNVZCXNIQKTFY72XMW37OR5ZCOWS2PG"
$FACTORY = "CBPUHIIP6FCVHUILXLMPKU3J3AUYBIUWGOASOGYRQKLMPSSN22HXOUFN"
$ENGINE = "CBOMKCJGCFEYJTTOKQX53NSA6OF66WIFYC4WVKJIF7GWSTVV6JI265AP"
$TOKEN = "CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR"
$ESCROW = "CCOIKNVMNVDIBJQGAWD6IUDJKGEJJ5UXHBD4R6ATMEGHUVAER4AAIVQS"

Write-Host "Initializing Escrow..."
stellar contract invoke --id $ESCROW --source deployer --network testnet --network-passphrase "Test SDF Network ; September 2015" -- initialize --admin $DEPLOYER

Write-Host "Initializing Factory..."
stellar contract invoke --id $FACTORY --source deployer --network testnet --network-passphrase "Test SDF Network ; September 2015" -- initialize --admin $DEPLOYER

Write-Host "Initializing Authorization..."
stellar contract invoke --id $AUTH --source deployer --network testnet --network-passphrase "Test SDF Network ; September 2015" -- initialize --admin $DEPLOYER --payment_engine $ENGINE

Write-Host "Initializing Token Wrapper..."
stellar contract invoke --id $TOKEN --source deployer --network testnet --network-passphrase "Test SDF Network ; September 2015" -- initialize --admin $DEPLOYER --payment_engine $ENGINE

Write-Host "Initializing Payment Engine..."
stellar contract invoke --id $ENGINE --source deployer --network testnet --network-passphrase "Test SDF Network ; September 2015" -- initialize --admin $DEPLOYER --auth_manager $AUTH --sub_factory $FACTORY --token_wrapper $TOKEN --fee_recipient $DEPLOYER --fee_bps 50

Write-Host "All initialized!"
