const BN = require('bn.js')
async function main() {
    let accounts = await ethers.getSigners()
    const owner = accounts[0]
    const ownerAddress = accounts[0].address
    const service = accounts[1]
    const serviceAddress = service.address
    const user = accounts[2]
    const userAddress = user.address
    log(`user: ${userAddress}`)

    const Usdc = await hre.ethers.getContractFactory('ERC20')
    let usdc = await Usdc.deploy("USDC", "USDC", 6, userAddress)
    usdc = await usdc.deployed()
    const usdcAddress = usdc.address
    tx = await usdc.mint(userAddress, sUsd(7000))
    await tx.wait()
    tx = await usdc.mint(ownerAddress, sUsd(100000) )
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
    tx = await testSwapRouter.setRatio(usdcAddress, wethAddress, 500000000000000) // 1 e18 / 2000 e6
    await tx.wait()
    tx = await testSwapRouter.setRatio(wethAddress, usdcAddress, 2490000000) // цена эфира 1500
    await tx.wait()

    const Payer = await hre.ethers.getContractFactory('PayerV3')
    let payer = await Payer.deploy()
    payer = await payer.deployed()
    const payerAddress = payer.address
    log(`Deploed Payer ${payerAddress}`)

    console.log(await payer.calculateProportion(333,1000))

    tx = await payer.editAcceptableToken(usdcAddress, true)
    await tx.wait()
    tx = await payer.editAcceptableToken(wethAddress, true)
    await tx.wait()
    tx = await payer.setWeth(wethAddress)
    await tx.wait() 
    tx = await payer.setUsdToken(usdcAddress)
    await tx.wait()    
    tx = await payer.setSwapRouter(testSwapRouterAddress)
    await tx.wait()


    /*
    user: Заносит 2000 USDC
    user: Создает ордер на покупку ETH за 2000 USDC длительностью в 5 минут
    serv: Проводим экспирацию начисляем $10
    user: Забирает только прибыль 
    user: Забирает все свои средства
    */
    
    log(`[user]: Разрешает контракту использовать 10000 USDC. Approve(10000)`)
    tx = await usdc.connect(user).approve(payerAddress, sUsd(10000))
    tx = await tx.wait()
    Helper.gasUsed(tx)

    const orderDuration = 5 
    const timeOut = 6

    log(`[contract]: Баланс пользователя ${cUsd(await payer.balanceOf(usdcAddress, userAddress))} USDC`)

    log(`[user]: USDC -> WETH Вносит на свой баланс в контракт и делает ордер`)
    tx = await payer.connect(user).depositAndOrder(usdcAddress, wethAddress, sUsd(2001), 2000, orderDuration)
    tx = await tx.wait()
    tx = await payer.connect(user).depositAndOrder(usdcAddress, wethAddress, sUsd(2303), 2000, orderDuration)
    tx = await tx.wait()
    tx = await payer.connect(user).depositAndOrder(usdcAddress, wethAddress, sUsd(2533), 2000, orderDuration)
    tx = await tx.wait()
  
    log(`[contract]: Баланс пользователя ${await payer.balanceOf(usdcAddress, userAddress)} USDC`)

    log(`[system]: Ждем ${timeOut} сек`)
    await wait(timeOut)

    log(`---EXPIRATION--`)
    log(`[user]: Вносим на баланс сервиса 1000 USDC`)
    tx = await usdc.approve(payerAddress, sUsd(1000))
    tx = await tx.wait()
    tx = await payer.deposit(usdcAddress, sUsd(1000))
    await tx.wait()
    log(`[contract]: Баланс в контракте - сервиса ${cUsd(await payer.balanceOf(usdcAddress, ownerAddress))} USDC`)
    log(`[service]: Исполняем ордер №0 пользователя`)
    
    tx = await payer.executeOrders([[0, 1, 2], [true, true, true], [sUsd(10), sUsd(10), sUsd(10)]])
    tx = await tx.wait()
    Helper.gasUsed(tx)

    log(`[user]: Исполняет свой ордер`)
    tx = await payer.connect(user).claimOrder(0)
    tx = await tx.wait()
    tx = await payer.connect(user).claimOrder(1)
    tx = await tx.wait()
    tx = await payer.connect(user).claimOrder(2)
    tx = await tx.wait()
    Helper.gasUsed(tx)

    // log(`[user]: Выводит свои средства`)
    // tx = await payer.connect(user).fullWithdrawal(usdcAddress, await payer.balanceOf(usdcAddress, userAddress))
    // tx = await tx.wait()
    // Helper.gasUsed(tx)

    log(`[contract]: Баланс в контракте - сервиса USDC ${cUsd(await payer.balanceOf(usdcAddress, ownerAddress))} `)
    log(`[contract]: Баланс в контракте - пользователя USDC ${cUsd(await payer.balanceOf(usdcAddress, userAddress))} `)
    log(`[contract]: Баланс в контракте - пользователя WETH ${await payer.balanceOf(wethAddress, userAddress)} `)
    
    
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
Helper = {
    gasUsed: (tx) => {
        //console.log(`Gas Used: ${tx.gasUsed}`)
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


function cEth(amount){
    return convertInt(amount, 18)
}
function cUsd(amount){
    return convertInt(amount, 6)
}
function sEth(amount){
    return amount * 1e18
}
function sUsd(amount){
    return amount * 1e6
}
function convertInt(amount, decimal, nums=2){
    const amountBn = new BN(amount.toString())
    const decimalBN = new BN(decimal.toString())
    const divisor = new BN(10).pow(decimalBN)

    const beforeDecimal = amountBn.div(divisor)
    const afterDecimal  = amountBn.mod(divisor)

    return `${beforeDecimal.toString()}.${afterDecimal.toString().substring(0,nums)}`
}