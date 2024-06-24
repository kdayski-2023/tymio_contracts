const { filterTextKeys, getNetworkName, makeReadable, convertTokenAmount, readableTokenAmount, IERC20, IERC20Metadata, replaceAddress } = require('../helpers/web3');
const axios = require('axios')
const deployments = require('../../deployments')
const apiUrl = 'https://api.tymio.com/api' //https://mars2.fanil.ru/api
const bn = ethers.BigNumber.from;
let payerV3,
    block,
    acceptableTokensArrayLength,
    networkName,
    wethAddress,
    maxAdditionalAmountPercentage,
    payerAddress

const swapsIn = {}
const swapsOut = {}
const acceptableTokensArray = []
const balances = {}
const additionalAmounts = []
const usdTokens = []


async function main() {
    const blockNumber = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNumber);

    const chainId = hre.network.config.network_id;
    networkName = getNetworkName(chainId)
    console.log(`Claim payouts`)
    console.log(`Сеть: ${networkName}`)
    console.log(`PayerV3 адрес: ${deployments.networks[networkName].payerV3}`)
    payerV3 = await ethers.getContractAt('PayerV3', deployments.networks[networkName].payerV3);
    wethAddress = await payerV3.wethAddress()
    wethAddress = wethAddress.toLowerCase()
    payerAddress = await payerV3.payerAddress();

    acceptableTokensArrayLength = Number(await payerV3.acceptableTokensArrayLength());
    for (let i = 0; i < acceptableTokensArrayLength; i++) {
        const acceptableTokenAddress = await payerV3.acceptableTokensArray(i)
        acceptableTokensArray.push(acceptableTokenAddress)
        if (await payerV3.isUsdToken(acceptableTokenAddress)) {
            usdTokens.push(acceptableTokenAddress.toLowerCase())
            additionalAmounts.push({ token: acceptableTokenAddress.toLowerCase(), additionalAmount: 0, payerBalance: await payerV3.balanceOf(acceptableTokenAddress, payerAddress) })
        }

    }
    const contractOrders = {}
    const startFrom = 1
    let ordersLength = 10000
    for (let orderId = startFrom; orderId <= ordersLength; orderId++) {
        try {
            const order = makeReadable(filterTextKeys(await payerV3.orders(orderId)))
            order._endTimestamp = getReadebleTimestamp(order.endTimestamp)
            order._orderId = orderId
            contractOrders[orderId] = order
        } catch (error) {
            ordersLength = orderId - 1
        }
    }
    console.log(`Всего ордеров (${ordersLength})`)
    // check Payer address balances
    
    for (let orderId = startFrom; orderId <= ordersLength; orderId++) {
        const order = contractOrders[orderId]
        console.log(order)
        console.log(`[${orderId}] ${order.completed} ${order.claimed} ${order.additionalAmount} `)    
        if (!order.claimed && order.additionalAmount > 0) {
            let payToken = order.tokenIn
            if (isUsdTokenCheck(order.tokenIn)) {
                payToken = order._tokenIn
            }
            if (isUsdTokenCheck(order.tokenOut)) {
                payToken = order._tokenOut
            }
            if(!isUsdTokenCheck(order.tokenIn) && !isUsdTokenCheck(order.tokenOut)){
                const userOrders = await apiGetUserOrders(order.user)
                const findedOrder = userOrders.find(o => o.contract_id == orderId && o.contract_version == 3)
                console.log('findedOrder')
                console.log(findedOrder)
            }
            
            const finded = additionalAmounts.find((o) => o.token == payToken.address)
            finded.additionalAmount += Number(order.additionalAmount)
            console.log(`   +${readableTokenAmount(payToken, order.additionalAmount)} ${payToken.name}`)
        }

    }
    console.log(`Выплаты пользователям:`)
    for (const additionalAmountToken of additionalAmounts) {
        const additionalToken = replaceAddress(additionalAmountToken.token)
        console.log(`${additionalToken.short} ${readableTokenAmount(additionalToken, additionalAmountToken.additionalAmount)} Доступно ${readableTokenAmount(additionalToken, additionalAmountToken.payerBalance)}`)
    }
}

function isUsdTokenCheck(token) {
    return usdTokens.includes(token.toLowerCase())
}
function getReadebleTimestamp(timestamp) {

    const pad = (n, s = 2) => (`${new Array(s).fill(0)}${n}`).slice(-s)
    const d = new Date(timestamp * 1000)
    const hours = pad(d.getHours() + 2)
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${pad(d.getFullYear(), 4)} ${hours}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
async function apiGetUserOrders(userAddress) {
    return new Promise((resolve) => {
        axios
            .get(
                `${apiUrl}/user_orders?userAddress=${userAddress}`
            )
            .then(function (response) {
                resolve(response.data.data)
            })
            .catch(function (error) {
                console.log(error)
            })
    })
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    });
