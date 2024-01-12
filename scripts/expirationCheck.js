const tokensInfo = [
    {address:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cid: 1, name: 'USDC', decimal: 6},
    {address:'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', cid: 1, name: 'WBTC', decimal: 8},
    {address:'0x0000000000000000000000000000000000000000', cid: 1, name: 'ETH', decimal: 18},
    {address:'0x0000000000000000000000000000000000000000', cid: 42161, name: 'ETH', decimal: 18},
    {address:'0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', cid: 42161, name: 'USDC', decimal: 6},
    {address:'0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', cid: 42161, name: 'WBTC', decimal: 8},
]

async function main({ owner, verbose } = {}) {
        let accounts = await ethers.getSigners()
    owner = accounts[0].address
    
    const chainId = 1 // 
    const PayerV2 = await hre.ethers.getContractAt('PayerV2', '0x0d0c69c9e31923712f2d51d994950d08ed9b2958' )
    if(await PayerV2.isEnoughPayoutAmount()){
        log.green(`isEnoughPayoutAmount: YES`)
    }else{
        log.red(`isEnoughPayoutAmount: NO`)
    }
    const payoutReport = await PayerV2.getPayoutReport()
    const tokens = payoutReport[0]
    const amounts = payoutReport[1]
    const users = payoutReport[2]
    
    for(const index in tokens){
        const tokenAddress = tokens[index]
        const amount = amounts[index]
        const user = users[index]
        const tokenInfo = tokensInfo.find(x => x.address === tokenAddress && x.cid === chainId )
        const decimal = tokenInfo.decimal
        const part0 = amount.toString().substr(-decimal,decimal)
        const part1 = amount.toString().substr(0,amount.toString().length-decimal)
        const lng = amount.toString().length
        const value = `${part1}.${part0}`
        console.log(`${user} ${tokenInfo.name} ${value} ${lng}`)
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