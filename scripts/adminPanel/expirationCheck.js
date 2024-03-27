const { filterTextKeys, getNetworkName, replaceAddresses } = require('../helpers/web3')
const contractParamsAll = { "1": { "_params": [[], [], []], "_amountOutMinimum": [], "_claimOrders": false, "_usdClaimToken": "" }, "42161": { "_params": [[], [], []], "_amountOutMinimum": [], "_claimOrders": false, "_usdClaimToken": "" }, "80001": { "_params": [[], [], []], "_amountOutMinimum": [], "_claimOrders": false, "_usdClaimToken": "" }, "421614": { "_params": [[55], [true], ["67528591"]], "_amountOutMinimum": ["6052007863"], "_claimOrders": false, "_usdClaimToken": "0x1DDC824D3af1f7d6c13eE9307817111A75D04520" } }
const deployments = require('../../deployments')
const bn = ethers.BigNumber.from
async function main() {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);

    const chainId = hre.network.config.network_id
    const networkName = getNetworkName(chainId)
    console.log(deployments.networks[networkName].payerV3)
    const payerV3 = await ethers.getContractAt("PayerV3", deployments.networks[networkName].payerV3);
    console.log(`Network ${networkName}`)
    const contractParams = contractParamsAll[chainId]
    console.log(`Contract params:`)
    console.log(contractParams)
    const orderIds = contractParams._params[0]
    for (const orderId of orderIds) {
        const order = await payerV3.orders(orderId)
        console.log(replaceAddresses(filterTextKeys(order)))
    }
    console.log(`Execution order IDs: ${orderIds}`)

    const acceptableTokensArrayLength = Number(await payerV3.acceptableTokensArrayLength())
    //#region PREPARING
    let acceptableTokensArray = []
    for (let i = 0; i < acceptableTokensArrayLength; i++) {
        acceptableTokensArray.push(await payerV3.acceptableTokensArray(i))
    }

    const swapsIn = {};
    const swapsOut = {};
    for (let i = 0; i < acceptableTokensArray.length; i++) {
        for (let j = 0; j < acceptableTokensArray.length; j++) {
            if (acceptableTokensArray[i] === acceptableTokensArray[j]) continue;
            if (!swapsIn[acceptableTokensArray[i]]) swapsIn[acceptableTokensArray[i]] = {};
            if (!swapsOut[acceptableTokensArray[i]]) swapsOut[acceptableTokensArray[i]] = {};
            swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] = bn(0);
            swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = bn(0);
        }
    }
    //#endregion
    console.log(`EMULATE executeOrders`)
    const _params = { orderIds: contractParams._params[0], swap: contractParams._params[1], additionalAmount: contractParams._params[2] }
    const orderIdsLength = orderIds.length

    // TODO ADD REVERT LENG ERROR
    for (let i = 0; i < orderIdsLength; i++) {
        const order = await payerV3.orders(orderIds[i])

        if (!(block.timestamp >= order.endTimestamp)) {
            revert("WrongExpirationTime()")
        }
        if (order.claimed) {
            revert("OrderAlreadyClaimed()")
        }
        if (order.completed) {
            revert("OrderAlreadyCompleted()")
        }
        if (_params.swap[i]) {
            swapsIn[order.tokenIn][order.tokenOut] = swapsIn[order.tokenIn][order.tokenOut].add(bn(order.amountIn.toString()))
        }
    }
    console.log(swapsIn)
}

function revert(msg) {
    console.log(`Reverted ${msg}`)
    // process.exit()
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
