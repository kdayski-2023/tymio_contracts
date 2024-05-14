const stage = 1 //сначала деплоим токены и роутер = 1 , payer = 2
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
    if (stage == 1) {
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
        log(`${usdtAddress}: usdt`);

        const Wbtc = await hre.ethers.getContractFactory('ERC20')
        let wbtc = await Wbtc.deploy("WBTC", "WBTC", 8)
        wbtc = await wbtc.deployed()
        const wbtcAddress = wbtc.address
        tx = await wbtc.mint(ownerAddress, sBtc(mintAmount))
        await tx.wait()
        log(`${wbtcAddress}: wbtc`);

        const WETH = await hre.ethers.getContractFactory('WETH9')
        let weth = await WETH.deploy()
        weth = await weth.deployed()
        const wethAddress = weth.address
        tx = await weth.mint(ownerAddress, sEth(mintAmount))
        await tx.wait()
        log(`${wethAddress}: weth`);
        return
        const TestSwapRouter = await hre.ethers.getContractFactory('TestSwapRouter');
        let testSwapRouter = await TestSwapRouter.deploy();
        testSwapRouter = await testSwapRouter.deployed();
        const testSwapRouterAddress = testSwapRouter.address;

        log(`${testSwapRouterAddress}: testSwapRouter`);
        console.log({
            usdcAddress,
            usdtAddress,
            wbtcAddress,
            wethAddress,
            testSwapRouterAddress,
        })
    }

    if (stage == 2) {
        const settings = {
            usdcAddress: '0xE090e328eE058CF04434e97eC1e77B959A3e10E3',
            usdtAddress: '0xe2a98aa4d6a22bD7B8A0b5bd17f1Cb051fdE87dF',
            wbtcAddress: '0xB2a846aE67aA33Cb6E482C388702C576d47EF79C:',
            wethAddress: '0xDBE7967FeEAbD50CA5c8897ce16FF4f40B5dEDB8',
            testSwapRouterAddress: ''
        }

        const Payer = await hre.ethers.getContractFactory('PayerV3');
        let payer = await Payer.deploy();
        payer = await payer.deployed();
        const payerAddress = payer.address;
        log(`${payerAddress}: PayerV3`);
        tx = await payer.editAcceptableToken(settings.usdcAddress, true, true, "10000000");
        await tx.wait();
        tx = await payer.editAcceptableToken(settings.usdtAddress, true, true, "10000000");
        await tx.wait();
        tx = await payer.editAcceptableToken(settings.wethAddress, true, false, "2600000000000000");
        await tx.wait();
        tx = await payer.editAcceptableToken(settings.wbtcAddress, true, false, "14285");
        await tx.wait();
    }

    log('All contract settings are set');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
