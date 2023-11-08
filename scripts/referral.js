async function main({ owner, verbose } = {}) {
    
    let accounts = await ethers.getSigners()
    owner = accounts[0].address
    const service = accounts[1]
    const serviceAddress = service.address
    const user = accounts[2]
    const userAddress = user.address
    log(`user: ${userAddress}`)
    const Usdc = await hre.ethers.getContractFactory('ERC20')
    let usdc = await Usdc.deploy("USDC", "USDC", 6, userAddress);
    usdc = await usdc.deployed()
    const usdcAddress = usdc.address
    // минтим пользователю
    tx = await usdc.mint(userAddress, 2000 * 1000000)
    await tx.wait()
    // минтим овнеру
    tx = await usdc.mint(owner, 100000 * 1000000)
    await tx.wait()

    log(`usdc: ${usdcAddress}`)

    const Referral = await hre.ethers.getContractFactory('Referral')
    let referral = await Referral.deploy()
    referral = await referral.deployed()
    const referralAddress = referral.address
    log(`Deploed Referral ${referralAddress}`)
    tx = await usdc.mint(referralAddress, 1000 * 1000000)
    await tx.wait()

    tx = await referral.setUsdc(usdcAddress)
    await tx.wait()
    
    tx = await referral.setServiceAddress(serviceAddress)
    await tx.wait()
    log(`[service]: Добавляем информацию о балансах`)
    tx = await referral.setBalances([userAddress],[100])
    await tx.wait()

    log(`[contrac]: User balance ${await referral.balanceOf(userAddress)}`)

    log(`[user]: Выводим 100`)
    tx = await referral.connect(user).withdrawal(100)
    await tx.wait()

    log(`[contrac]: User balance ${await referral.balanceOf(userAddress)}`)

    // log(`[user]: Еще раз выводим 100`)
    // tx = await referral.connect(user).withdrawal(100)
    // await tx.wait()


    
    log(`Работа с сервисом`)
    log(`[service]: В конце месяца заносим сведения`)
    tx = await referral.connect(service).addBalances([userAddress],[100])
    await tx.wait()
    log(`[contrac]: User balance ${await referral.balanceOf(userAddress)}`)
    log(`[service]: В конце месяца заносим сведения`)
    tx = await referral.connect(service).addBalances([userAddress],[100])
    await tx.wait()
    log(`[contrac]: User balance ${await referral.balanceOf(userAddress)}`)

    log(`[user]: Выводим 200`)
    tx = await referral.connect(user).withdrawal(200)
    await tx.wait()

    log(`[contrac]: User balance ${await referral.balanceOf(userAddress)}`)

    const tokenBalance = await referral.getTokenBalance(usdcAddress)
    log(`[contrac]: USDC balance ${tokenBalance}`)
    log(`[owner]: Забираем все USDC`)
    tx = await referral.getBackErc20(usdcAddress,owner,tokenBalance)
    await tx.wait()
    log(`[contrac]: USDC balance ${await referral.getTokenBalance(usdcAddress)}`)

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