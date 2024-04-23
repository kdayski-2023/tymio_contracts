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
    if (stage == 1) {
        const Usdc = await hre.ethers.getContractFactory('ERC20')
        let usdc = await Usdc.deploy("USDC", "USDC", 6)
        usdc = await usdc.deployed()
        const usdcAddress = usdc.address
        tx = await usdc.mint(ownerAddress, sUsd(mintAmount))
        await tx.wait()
        log(`${usdcAddress}: usdc`);

        console.log({
            usdcAddress,
        })
    }

    if (stage == 2) {
        const settings = {
            usdcAddress: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            usdc2Address: '0x895b58ef78EcFC008F50c907A124b2646b390201',
            wethAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        }
        // 0x44EBD1bC3e75BECf7Cb428bf5571cf28629DB079
        const Payer = await hre.ethers.getContractFactory('PayerV3');
        let payer = await Payer.deploy();
        payer = await payer.deployed();
        const payerAddress = payer.address;
        log(`${payerAddress}: PayerV3`);
        tx = await payer.editAcceptableToken(settings.usdcAddress, true, true, "10000000");
        await tx.wait();
        tx = await payer.editAcceptableToken(settings.usdc2Address, true, true, "10000000");
        await tx.wait();
        tx = await payer.editAcceptableToken(settings.wethAddress, true, false, "2600000000000000");
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
