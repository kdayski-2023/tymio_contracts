const BN = require('bn.js')
async function main() {
    let accounts = await ethers.getSigners()
    console.log(accounts.length)
    
    const owner = accounts[0]
    const ownerAddress = accounts[0].address
    const service = accounts[1]
    const serviceAddress = service.address
    const user = accounts[2]
    const userAddress = user.address
    log(`user: ${userAddress}`)
    
    const Usdc = await hre.ethers.getContractFactory('ERC20')
    let usdc = await Usdc.deploy("USDC", "USDC", 6)
    usdc = await usdc.deployed()
    const usdcAddress = usdc.address
    tx = await usdc.mint(userAddress, sUsd(7000))
    await tx.wait()
    tx = await usdc.mint(ownerAddress, sUsd(100000) )
    await tx.wait()
    log(`usdc: ${usdcAddress}`)

    const Usdt = await hre.ethers.getContractFactory('ERC20')
    let usdt = await Usdt.deploy("USDT", "USDT", 6)
    usdt = await usdt.deployed()
    const usdtAddress = usdt.address
    tx = await usdt.mint(userAddress, sUsd(7000))
    await tx.wait()
    tx = await usdt.mint(ownerAddress, sUsd(100000) )
    await tx.wait()
    log(`usdt: ${usdtAddress}`)

    const Wbtc = await hre.ethers.getContractFactory('ERC20')
    let wbtc = await Wbtc.deploy("WBTC", "WBTC", 8)
    wbtc = await wbtc.deployed()
    const wbtcAddress = wbtc.address
    tx = await wbtc.mint(userAddress, sBtc(1))
    await tx.wait()
    tx = await wbtc.mint(ownerAddress, sBtc(1) )
    await tx.wait()
    log(`wbtc: ${wbtcAddress}`)

    const WETH = await hre.ethers.getContractFactory('WETH9')
    let weth = await WETH.deploy()
    weth = await weth.deployed()
    const wethAddress = weth.address
    log(`wethAddress: ${wethAddress}`)
    await owner.sendTransaction({to: wethAddress, value: sEth(100)});// отправив на weth эфиров, при свапе происходит минт и порой не хватает средств в тестовой среде

    const TestSwapRouter = await hre.ethers.getContractFactory('TestSwapRouter')
    let testSwapRouter = await TestSwapRouter.deploy()
    testSwapRouter = await testSwapRouter.deployed()
    const testSwapRouterAddress = testSwapRouter.address
    tx = await testSwapRouter.setRatio(usdcAddress, wethAddress, 500000000000000) // 500000000000000 = 2000$ $1900
    await tx.wait()
    tx = await testSwapRouter.setRatio(usdtAddress, wethAddress, 500000000000000) // 500000000000000 = 2000$ $1900
    await tx.wait()
    tx = await testSwapRouter.setRatio(wethAddress, usdcAddress, 2000000000) // цена эфира 1900
    await tx.wait()

    const Payer = await hre.ethers.getContractFactory('PayerV3')
    let payer = await Payer.deploy()
    payer = await payer.deployed()
    const payerAddress = payer.address
    log(`Deploed Payer ${payerAddress}`)

    tx = await payer.editAcceptableToken(usdcAddress, true, true)
    await tx.wait()
    tx = await payer.editAcceptableToken(usdtAddress, true, true)
    await tx.wait()
    tx = await payer.editAcceptableToken(wethAddress, true, false)
    await tx.wait()
    tx = await payer.setWeth(wethAddress)
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
    tx = await usdt.connect(user).approve(payerAddress, sUsd(10000))
    tx = await tx.wait()

    const orderDuration = 5 
    const timeOut = 6


    log(`[user]: USDC -> WETH Вносит на свой баланс в контракт и делает ордер`)
    // на рынке цена 2000
    tx = await payer.connect(user).depositAndOrder(usdcAddress, wethAddress, sUsd(3000), sUsd(2100), orderDuration) // buy 
    tx = await tx.wait()
    tx = await payer.connect(user).depositAndOrder(usdcAddress, wethAddress, sUsd(2000), sUsd(2100), orderDuration)
    tx = await tx.wait()
    tx = await payer.connect(user).depositAndOrder(usdcAddress, wethAddress, sUsd(1000), sUsd(2100), orderDuration)
    tx = await tx.wait()
    tx = await payer.connect(user).depositAndOrder(usdtAddress, wethAddress, sUsd(1000), sUsd(2100), orderDuration)
    tx = await tx.wait()
    tx = await payer.connect(user).depositEthAndOrder(wethAddress, usdcAddress, sEth(1), sUsd(1900), orderDuration, { value: sEth(1) }) // sell
    tx = await tx.wait()
  
    log(`[contract]: Баланс пользователя ${await payer.balanceOf(usdcAddress, userAddress)} USDC`)

    log(`[system]: Ждем ${timeOut} сек`)
    await wait(timeOut)

    log(`---EXPIRATION--`)
    log(`[user]: Вносим на баланс сервиса по 1000 USD`)
    tx = await usdc.approve(payerAddress, sUsd(1000))
    tx = await tx.wait()
    tx = await payer.deposit(usdcAddress, sUsd(1000))
    await tx.wait()
    tx = await usdt.approve(payerAddress, sUsd(1000))
    tx = await tx.wait()
    tx = await payer.deposit(usdtAddress, sUsd(1000))
    await tx.wait()
    log(`[contract]: Баланс в контракте - сервиса ${cUsd(await payer.balanceOf(usdcAddress, ownerAddress))} USDC`)
    log(`[service]: Исполняем ордер №0 пользователя`)
    
    tx = await payer.executeOrders([[0, 1, 2, 3, 4], [true, true, true, true, true], [sUsd(10), sUsd(10), sUsd(10), sUsd(10), sUsd(10)]])
    tx = await tx.wait()

    log(`[user]: Исполняет свой ордер`)
    tx = await payer.connect(user).claimOrder(0, usdcAddress, false)
    tx = await tx.wait()
    tx = await payer.connect(user).claimOrder(1, usdcAddress, false)
    tx = await tx.wait()
    tx = await payer.connect(user).claimOrder(2, usdcAddress, false)
    tx = await tx.wait()
    tx = await payer.connect(user).claimOrder(3, usdcAddress, false)
    tx = await tx.wait()
    tx = await payer.connect(user).claimOrder(4, usdcAddress, false)
    tx = await tx.wait()

    console.log(cEth(await ethers.provider.getBalance(userAddress)))
    console.log(cEth(await ethers.provider.getBalance(payerAddress)))
    console.log(cEth(await ethers.provider.getBalance(wethAddress)))
    log(`[user]: Выводит свои средства ETH`)
    tx = await payer.connect(user).fullWithdrawalETH(await payer.balanceOf(wethAddress, userAddress))
    tx = await tx.wait()

    
    log(`[contract]: Баланс в контракте - сервиса USDC ${cUsd(await payer.balanceOf(usdcAddress, ownerAddress))} `)
    log(`[contract]: Баланс в контракте - сервиса USDT ${cUsd(await payer.balanceOf(usdtAddress, ownerAddress))} `)
    log(`[contract]: Баланс в контракте - сервиса WETH ${cEth(await payer.balanceOf(wethAddress, ownerAddress))} `)
    log(`[contract]: Баланс в контракте - пользователя USDC ${cUsd(await payer.balanceOf(usdcAddress, userAddress))} `)
    log(`[contract]: Баланс в контракте - пользователя USDT ${cUsd(await payer.balanceOf(usdtAddress, userAddress))} `)
    log(`[contract]: Баланс в контракте - пользователя WETH ${cEth(await payer.balanceOf(wethAddress, userAddress))} `)
    console.log(cEth(await ethers.provider.getBalance(userAddress)))
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
function cBtc(amount){
    return convertInt(amount, 8)
}
function sEth(amount){
    return convertStr(amount, 18)
}
function sUsd(amount){
    return convertStr(amount, 6)
}
function sBtc(amount){
    return convertStr(amount, 8)
}
function convertInt(amount, decimal, nums = 4) {
    const amountBn = new BN(amount.toString());
    const decimalBN = new BN(decimal.toString());
    const divisor = new BN(10).pow(decimalBN);
  
    const beforeDecimal = amountBn.div(divisor);
    const afterDecimal = amountBn.mod(divisor);
  
    const afterDecimalStr = afterDecimal.toString(10).padStart(decimal, '0');
  
    return `${beforeDecimal.toString()}.${afterDecimalStr.substr(0, nums)}`;
  }
function convertStr(amount, decimal){
    const amountBn = new BN(amount.toString())
    const decimalBN = new BN(decimal.toString())
    const divisor = new BN(10).pow(decimalBN)
    return amountBn.mul(divisor).toString()
}