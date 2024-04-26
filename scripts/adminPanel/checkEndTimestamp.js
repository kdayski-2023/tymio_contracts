const { color, log, bold, bgCyan, bgGreen, bgGreenBright, white, magenta, red, green, cyan, cyanBright } = require('console-log-colors');
const { filterTextKeys, getNetworkName, makeReadable, convertTokenAmount, readableTokenAmount, IERC20, IERC20Metadata, replaceAddress } = require('../helpers/web3');

const ethPrice = 3085 * 1000000 // TODO GET DINAMIC FROM BCH
const btcPrice = 70800 * 1000000
const contractParamsAll = { "1": { "_params": [[0], [false], ["10384184"]], "_amountOutMinimum": [], "_claimOrders": false, "_usdClaimToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }, "42161": { "_params": [[32, 45, 34, 42, 43, 29, 27, 35, 40, 37, 36, 38, 47, 48, 50, 31, 33, 30, 44, 11, 51, 49, 28, 39, 54, 41, 46], [true, false, true, false, false, true, false, false, false, true, true, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false, false], ["13090050", "1142982", "40748913", "1954356", "7431444", "61580640", "19811400", "18224584", "8665468", "11356423", "6244223", "6867462", "1142628", "32562443", "103791408", "34927900", "19345312", "20948819", "11452832", "13677591", "9132238", "103730928", "103016659", "594584020", "8990455", "17629528", "8447939"]], "_amountOutMinimum": ["3085559633417016600", "3823415"], "_claimOrders": false, "_usdClaimToken": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8" }, "421614": { "_params": [[], [], []], "_amountOutMinimum": [], "_claimOrders": false, "_usdClaimToken": "" } }
const deployments = require('../../deployments');

const bn = ethers.BigNumber.from;
let payerV3,
  block,
  acceptableTokensArrayLength,
  networkName,
  wethAddress,
  maxAdditionalAmountPercentage,
  payerAddress;
const swapsIn = {};
const swapsOut = {};
const acceptableTokensArray = [];
const balances = {};


async function main() {
  const blockNumber = await ethers.provider.getBlockNumber();
  block = await ethers.provider.getBlock(blockNumber);

  const chainId = hre.network.config.network_id;
  console.log(chainId)
  networkName = getNetworkName(chainId)
  log.blue(`Сеть: ${networkName}`)
  log.blue(`PayerV3 адресс: ${deployments.networks[networkName].payerV3}`)
  log.blue(`Цены: ETH: $${ethPrice / 1000000}, BTC: $${btcPrice / 1000000}`)
  payerV3 = await ethers.getContractAt('PayerV3', deployments.networks[networkName].payerV3);
  
}


const safeDiv = (a, b) => {
  const quotient = a.div(b)
  if (a.mul(10).div(b).abs().mod(10).gte(5)) {
    if (quotient.lt(0)) {
      return quotient.sub(1)
    }
    return quotient.add(1)
  }
  return quotient
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
