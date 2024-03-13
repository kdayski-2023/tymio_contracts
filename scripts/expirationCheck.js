const BN = require('bn.js')
const tokensInfo = [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cid: 1, name: 'USDC', decimal: 6 },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', cid: 1, name: 'WBTC', decimal: 8 },
    { address: '0x0000000000000000000000000000000000000000', cid: 1, name: 'ETH', decimal: 18 },
    { address: '0x0000000000000000000000000000000000000000', cid: 42161, name: 'ETH', decimal: 18 },
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', cid: 42161, name: 'USDC', decimal: 6 },
    { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', cid: 42161, name: 'WBTC', decimal: 8 },
]

async function main({ owner, verbose } = {}) {
    let accounts = await ethers.getSigners()
    owner = accounts[0].address

    const chainId = 42161    // 42161
    const PayerV2 = await hre.ethers.getContractAt('PayerV2', '0x0d0c69c9e31923712f2d51d994950d08ed9b2958')
    if (await PayerV2.isEnoughPayoutAmount()) {
        log.green(`isEnoughPayoutAmount: YES`)
    } else {
        log.red(`isEnoughPayoutAmount: NO`)
    }
    const payoutReport = await PayerV2.getPayoutReport()
    const tokens = payoutReport[0]
    const amounts = payoutReport[1]
    const users = payoutReport[2]
    console.log(`Count is ${tokens.length}`)

    const resultData = []
    for (const index in tokens) {
        const address = tokens[index]
        const amount = amounts[index]
        const user = users[index]
        resultData.push({ address, amount, user })
    }
    resultData.sort(dynamicSort('user')) // !CHECK
    for (const data of resultData) {
        const tokenAddress = data.address
        const amount = data.amount
        const user = data.user
        const tokenInfo = tokensInfo.find(x => x.address === tokenAddress && x.cid === chainId)
        const decimal = tokenInfo.decimal
        const lng = amount.toString().length
        // const value = `${part1}.${part0}`
        const value = convertInt2(amount.toString(), decimal)
        console.log(`${user} ${tokenInfo.name} ${value} ${lng} ${amount.toString()}`)
    }
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
function dynamicSort(property) {
    var sortOrder = 1;
    if (property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a, b) {
        /* next line works with strings and numbers, 
         * and you may want to customize it to your needs
         */
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
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
const reset = "\x1b[0m";

const log = {
    green: (text) => console.log("\x1b[32m" + text + reset),
    red: (text) => console.log("\x1b[31m" + text + reset),
    blue: (text) => console.log("\x1b[34m" + text + reset),
    yellow: (text) => console.log("\x1b[33m" + text + reset),
};

function convertInt(amount, decimal, nums = 4) {
    const amountBn = new BN(amount.toString())
    const decimalBN = new BN(decimal.toString())
    const divisor = new BN(10).pow(decimalBN)

    const beforeDecimal = amountBn.div(divisor)
    const afterDecimal = amountBn.mod(divisor)

    return `${beforeDecimal.toString()}.${afterDecimal.toString().substring(0, nums)}`
}
function convertInt2(amount, decimal, nums = 4) {
    const amountBn = new BN(amount.toString());
    const decimalBN = new BN(decimal.toString());
    const divisor = new BN(10).pow(decimalBN);

    const beforeDecimal = amountBn.div(divisor);
    const afterDecimal = amountBn.mod(divisor);

    const afterDecimalStr = afterDecimal.toString(10).padStart(decimal, '0');

    return `${beforeDecimal.toString()}.${afterDecimalStr.substr(0, nums)}`;
}