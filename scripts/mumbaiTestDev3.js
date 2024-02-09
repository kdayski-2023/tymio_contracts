const BN = require('bn.js')
async function main() {
    let accounts = await ethers.getSigners()
    console.log(accounts.length)
    return
    const owner = accounts[0]
    const ownerAddress = accounts[0].address
    console.log(ownerAddress)

    const usdcAddress = '0xDdE3f67f0A697B0f4633F4869F3E21135eb89156'
    const usdc = await hre.ethers.getContractAt("ERC20", usdcAddress)
    console.log(await usdc.balanceOf(ownerAddress))
    const payerAddress = '0xF8b56f97bc0BF45d89CC7F4f42549EA47e0e9847'
    const payer = await hre.ethers.getContractAt("PayerV3", payerAddress)
    console.log(await payer.owner1())
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })