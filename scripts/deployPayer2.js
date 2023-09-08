async function main({ owner, verbose } = {}) {
    
    let accounts = await ethers.getSigners()
    owner = accounts[0].address
    const usdcAddress = "0xfC56319A12EE1784cA05B3EF5b92a4812DcbF082"// MUSDC
    const wethAddress = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"

    const usdc = await hre.ethers.getContractAt("ERC20", usdcAddress)

    const PayerV2 = await hre.ethers.getContractFactory('PayerV2')
    let payerV2 = await PayerV2.deploy()
    payerV2 = await payerV2.deployed()
    
    const payerV2Address = payerV2.address
    log(`Deploed PayerV2 ${payerV2Address}`)

    tx = await payerV2.editAcceptableToken(usdcAddress, true)
    await tx.wait()
    tx = await payerV2.editAcceptableToken(wethAddress, true)
    await tx.wait()

    tx = await usdc.transfer(payerV2Address, 1000 * 100000000)
    await tx.wait()

    log(`All done`)
}
main({ owner: process.env.OWNER, verbose: true })
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
Helper = {
    gasUsed: (tx) => {
        console.log(`Gas Used: ${tx.gasUsed}`)
    }
}
const log = (...args) => {
    console.log(...args)
}
function clog(msg) {
    console.log(`\r\n+++ ${msg} +++`)
}
function wait(seconds) {
    return new Promise(resolve => {
        setTimeout(resolve, seconds * 1000);
    });
}