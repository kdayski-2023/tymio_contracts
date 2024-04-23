const BN = require('bn.js')
async function main() {
    let accounts = await ethers.getSigners()
    const usdc2Address = '0x564855dCd4E6D1450A29eF4Fc97d7289251526A6'
    const payerV3Address = '0x44EBD1bC3e75BECf7Cb428bf5571cf28629DB079'
    const owner = accounts[0]
    const ownerAddress = accounts[0].address
    console.log(ownerAddress)
    const payerV3 = await hre.ethers.getContractAt('PayerV3', payerV3Address)
    console.log(await payerV3.orders(2))
    await payerV3.callStatic.executeOrders([[2], [true], [0]], [1], false, usdc2Address)

    // const out = await payerV3.callStatic.editAcceptableToken('0x44EBD1bC3e75BECf7Cb428bf5571cf28629DB079', true, true, "10000000")
    // const uniswapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

    // // Адрес токена, который вы хотите получить
    // const tokenAddress = usdc2Address
    // const WETH9Address = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
    // // Address of the Uniswap V3 router contract on mainnet

    // // Address of the token you want to receive

    // // Amount of ETH you want to swap (1 ETH in this case)
    // const ethAmount = ethers.utils.parseEther("1");

    // // Get the Uniswap router contract instance
    // const router = await ethers.getContractAt("@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol:ISwapRouter", uniswapRouterAddress);

    // // Define the pool fee tier (e.g., 3000 for 0.3%)
    // const poolFee = 3000;

    // // Create params for exactInputSingle swap
    // const params = {
    //     tokenIn: tokenAddress,
    //     tokenOut: WETH9Address,
    //     fee: poolFee,
    //     recipient: "0xE36490e9aEe2cCc6870F31706E358481b8ec5D6d", // Address to receive tokens
    //     deadline: Math.floor(Date.now() / 1000) + 60 * 10, // 20 minutes from now
    //     amountIn: '100000000',
    //     amountOutMinimum: 0, // You might want to set a minimum output amount
    //     sqrtPriceLimitX96: 0, // This can be used for price protection
    // };

    // // Estimate the amount of tokens you would receive
    // const amountsOut = await router.callStatic.exactInputSingle(params);

    // console.log(`For 1 ETH, you would receive approximately ${ethers.utils.formatUnits(amountsOut, 18)} tokens.`);
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


function cEth(amount) {
    return convertInt(amount, 18)
}
function cUsd(amount) {
    return convertInt(amount, 6)
}
function cBtc(amount) {
    return convertInt(amount, 8)
}
function sEth(amount) {
    return convertStr(amount, 18)
}
function sUsd(amount) {
    return convertStr(amount, 6)
}
function sBtc(amount) {
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
function convertStr(amount, decimal) {
    const amountBn = new BN(amount.toString())
    const decimalBN = new BN(decimal.toString())
    const divisor = new BN(10).pow(decimalBN)
    return amountBn.mul(divisor).toString()
}