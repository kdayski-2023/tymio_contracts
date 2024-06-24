const stage = 2 //сначала деплоим токены и роутер = 1 , payer = 2
const BN = require('bn.js');

const log = (...args) => {
    console.log(...args);
};
function sEth(amount) {
    return convertStr(amount, 18);
}
function sUsd(amount) {
    return convertStr(amount, 6);
}
function sBtc(amount) {
    return convertStr(amount, 8);
}
function convertStr(amount, decimal) {
    const amountBn = new BN(amount.toString());
    const decimalBN = new BN(decimal.toString());
    const divisor = new BN(10).pow(decimalBN);
    return amountBn.mul(divisor).toString();
}

async function main() {
    let accounts = await ethers.getSigners()
    const owner = accounts[0]
    const ownerAddress = accounts[0].address
    const mintAmount = 1000000;
    const usdWbtcPrice = 2300; // цена 1 usd к btc
    const wbtcUsdPrice = 43063540000; // цена 1 btc к usd
    const ethUsdPrice = 2363590000; // цена 1 eth к usd
    const usdEthPrice = 4200000000000000; // цена 1 usd к eth
    log(`${ownerAddress}: owner`);

    const Usdc = await hre.ethers.getContractFactory('ERC20')
    let usdc = await Usdc.deploy("USDC", "USDC", 6)
    usdc = await usdc.deployed()
    const usdcAddress = usdc.address
    tx = await usdc.mint(ownerAddress, sUsd(mintAmount))
    await tx.wait()

    log(`${usdcAddress}: usdc`);

    const Usdt = await hre.ethers.getContractFactory('ERC20')
    let usdt = await Usdt.deploy("USDT", "USDT", 6)
    usdt = await usdt.deployed()
    const usdtAddress = usdt.address
    tx = await usdt.mint(ownerAddress, sUsd(mintAmount))
    await tx.wait()
    log(`${usdtAddress}: usdc`);

    const WETH = await hre.ethers.getContractFactory('WETH9')
    let weth = await WETH.deploy()
    weth = await weth.deployed()
    const wethAddress = weth.address
    tx = await weth.mint(ownerAddress, sEth(mintAmount))
    await tx.wait()
    log(`${wethAddress}: weth`);



    const Payer = await hre.ethers.getContractFactory('PayerV3');
    let payer = await Payer.deploy();
    payer = await payer.deployed();
    const payerAddress = payer.address;
    log(`${payerAddress}: PayerV3`);
    tx = await payer.editAcceptableToken(usdcAddress, true, true, "1");
    await tx.wait();

    tx = await usdc.approve(payerAddress, sUsd(mintAmount))
    await tx.wait()
    tx = await usdt.approve(payerAddress, sUsd(mintAmount))
    await tx.wait()

    const maxOrders = 100 //

    for (let i = 0; i < maxOrders; i++) {
        tx = await payer.depositAndOrder(usdcAddress, usdtAddress, 2, 2, i, 0);
        await tx.wait();
        console.log(i)
    }
    let params = [[], [], []]
    for (let i = 0; i < maxOrders; i++) {
        params[0].push(i)
        params[1].push(false)
        params[2].push(1)
    }
    tx = await payer.executeOrders(params, [], false, usdcAddress);
    tx = await tx.wait();
    console.log(tx)

    log('All contract settings are set');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
