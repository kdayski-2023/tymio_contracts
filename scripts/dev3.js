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
    const WETH = await hre.ethers.getContractFactory('WETH9')
    let weth = await WETH.deploy()
    weth = await weth.deployed()
    const wethAddress = weth.address
    log(`wethAddress: ${wethAddress}`)

    const TestSwapRouter = await hre.ethers.getContractFactory('TestSwapRouter')
    let testSwapRouter = await TestSwapRouter.deploy()
    testSwapRouter = await testSwapRouter.deployed()
    const testSwapRouterAddress = testSwapRouter.address

    const Payer = await hre.ethers.getContractFactory('PayerV3')
    let payer = await Payer.deploy()
    payer = await payer.deployed()
    
    const payerAddress = payer.address
    log(`Deploed Payer ${payerAddress}`)

    tx = await payer.editAcceptableToken(usdcAddress, true)
    await tx.wait()
    tx = await payer.editAcceptableToken(wethAddress, true)
    await tx.wait()
    tx = await payer.setWeth(wethAddress)
    await tx.wait()    
    tx = await payer.setSwapRouter(testSwapRouterAddress)
    await tx.wait()
    /*
    user: Заносит 2000 USDC
    user: Создает ордер. на 2000 USDC длительностью в 5 минут
    serv: Проводим экспирацию начисляем $10
    user: Забирает только прибыль 
    user: Забирает все свои средства
    */

    log(`[user]: Разрешает контракту использовать 2000 USDC. Approve(2000)`)
    tx = await usdc.connect(user).approve(payerAddress, 2000 * 1000000)
    await tx.wait()

    log(`[user]: Вносит на свой баланс в контракт ранее разрешенную сумму 2000 USDC`)
    tx = await payer.connect(user).deposit(usdcAddress, 2000 * 1000000)
    await tx.wait()
    const orderDuration = 30 
    

    log(`[contract]: Баланс пользователя ${await payer.balanceOf(usdcAddress, userAddress)} USDC`)
    log(`[user]: Создает ордер. на 2000 USDC длительностью в ${orderDuration} секунд`)
    tx = await payer.connect(user).makeOrder(usdcAddress, 2000 * 1000000, orderDuration)
    await tx.wait()

    log(`[contract]: Ордера пользователя`)
    
    const timeOut = 10

    log(`[system]: Ждем ${timeOut} сек`)
    await wait(timeOut)

    log(`---EXPIRATION--`)
    log(`[user]: Вносим на баланс сервиса 1000 USDC`)
    tx = await usdc.approve(payerAddress, 1000 * 1000000)
    await tx.wait()
    tx = await payer.deposit(usdcAddress, 1000 * 1000000)
    await tx.wait()
    log(`[contract]: Баланс в контракте - сервиса ${await payer.balanceOf(usdcAddress, owner)} USDC`)

    log(`[service]: Исполняем ордер №0 пользователя`)
    
    tx = await payer.executeOrder(0, false, 10 * 1000000)
    await tx.wait()
    log(`[contract]: Баланс в контракте - сервиса ${await payer.balanceOf(usdcAddress, owner)} USDC`)
    log(`[contract]: Баланс в контракте - пользователя ${await payer.balanceOf(usdcAddress, userAddress)} USDC`)
    
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