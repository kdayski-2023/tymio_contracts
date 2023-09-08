async function main({ owner, verbose } = {}) {
    /* #region  START PARAMS */
    const log = (...args) => {
        if (verbose) {
            console.log(...args)
        }
    }
    let accounts = await ethers.getSigners()
    owner = accounts[0].address
    /* #endregion */

    // #region PREPARING
    const Weth9 = await hre.ethers.getContractFactory('WETH9')

    let weth9 = await Weth9.deploy()
    
    weth9 = await weth9.deployed()
    
    const weth9Address = weth9.address
    log(`Deploed WETH9 ${weth9Address}`)

    let tx = await weth9.deposit({ value: hre.ethers.utils.parseEther("1.0")})
    await tx.wait()

    const WETH9Test = await hre.ethers.getContractFactory('WETH9Test')
    let weth9Test = await WETH9Test.deploy()
    weth9Test = await weth9Test.deployed()

    const weth9TestAddress = weth9Test.address
    log(`Deploed WETH9Test ${weth9TestAddress}`)

    tx = await weth9Test.setWeth(weth9Address)
    await tx.wait()

    tx = await weth9.transfer(weth9TestAddress,1000)
    await tx.wait()

    log(`Balance WETH9Test of WETH ${await weth9.balanceOf(weth9TestAddress)}`)

    tx = await weth9Test.withdraw(100)
    await tx.wait()
    log(`Balance WETH9Test of WETH ${await weth9.balanceOf(weth9TestAddress)}`)

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
function clog(msg) {
    console.log(`\r\n+++ ${msg} +++`)
}
function wait(seconds) {
    return new Promise(resolve => {
        setTimeout(resolve, seconds * 1000);
    });
}