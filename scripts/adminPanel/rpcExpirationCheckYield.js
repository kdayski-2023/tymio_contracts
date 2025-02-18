const { filterTextKeys, getNetworkName, makeReadable, convertTokenAmount, readableTokenAmount, IERC20, IERC20Metadata, replaceAddress } = require('../helpers/web3');
var fs = require('fs');
const axios = require('axios')
const deployments = require('../../deployments')
const apiUrl = 'https://api.tymio.com/api' //https://mars2.fanil.ru/api
const dataPrices = JSON.parse(fs.readFileSync('./temp/prices.json', 'utf8'));
console.log(dataPrices)
const btcPrice = Math.floor(dataPrices.BTC) * 1000000
const ethPrice = Math.floor(dataPrices.ETH) * 1000000

const bn = ethers.BigNumber.from;
let payerV3,
  block,
  acceptableTokensArrayLength,
  networkName,
  wethAddress,
  maxAdditionalAmountPercentage,
  payerAddress,
  payerAddress1
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
  console.log(`Сеть: ${networkName}`)
  console.log(`PayerV3 адрес: ${deployments.networks[networkName].payerV3}`)
  console.log(`Цены: ETH: $${ethPrice / 1000000}, BTC: $${btcPrice / 1000000}`)
  payerV3 = await ethers.getContractAt('PayerV3', deployments.networks[networkName].payerV3);
  wethAddress = await payerV3.wethAddress()
  payerAddress1 = await payerV3.payerAddress()
  wethAddress = wethAddress.toLowerCase()
  maxAdditionalAmountPercentage = await payerV3.maxAdditionalAmountPercentage()
  payerAddress = await payerV3.payerAddress();
  const contractParams = JSON.parse(fs.readFileSync('./temp/data.json', 'utf8'));
  const orderIds = contractParams._params[0];
  const contractOrders = {}
  const orderTimestamps = []
  const sum = contractParams._params[2].reduce((partialSum, a) => Number(partialSum) + Number(a), 0)
  console.log(`Ордера (${orderIds.length}): ${orderIds}`)

  for (let i = 0; i < orderIds.length; i++) {
    const orderId = contractParams._params[0][i]
    const order = makeReadable(filterTextKeys(await payerV3.orders(orderId)))
    contractOrders[orderId] = order
    orderTimestamps.push(order.endTimestamp)

    // Подробное время
    console.log(`[${orderId}] ${getReadebleTimestamp(order.endTimestamp)}`)

    const needSwap = contractParams._params[1][i]
    let amountTxt = ''
    if (needSwap) {
      amountTxt = `SWAP ${readableTokenAmount(order._tokenIn, order.amountIn)} (${order.amountIn}) ${order._tokenIn.short} ==> ${order._tokenOut.short}`
    } else {
      amountTxt = `==> ${readableTokenAmount(order._tokenIn, order.amountIn)} (${order.amountIn}) ${order._tokenIn.short}`
    }
    const additionalAmount = convertTokenAmount(contractParams._params[2][i], 6)

    console.log(`[${orderId}] ${amountTxt} + ${additionalAmount} usd (${convertTokenAmount(order.price, 6)}) `)
  }
  // orders check
  if (true) {
    console.log(`Проверка ордеров на валидность`)
    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i]
      const order = contractOrders[orderId]
      const needSwap = contractParams._params[1][i]
      const userOrders = await apiGetUserOrders(order.user)
      const findedOrder = userOrders.find(o => o.contract_id == orderId && o.contract_version == 3)
      const apiOrderPrice = readableTokenAmount(order._tokenOut, order.price)

      if (!bn(order.price).eq(bn(findedOrder.price * 1000000))) {
        console.log(`   [${orderId}] Ошибка цены ${order.price} != ${findedOrder.price * 1000000}`)
      } else {
        // console.log(`   [${orderId}] Correct ${order.price} != ${findedOrder.price * 1000000}`)
        console.log(`   [${orderId}] Correct (${order.price})`)
      }
      // if (order._tokenIn.name == 'WBTC') {
      //   if(btcPrice < apiOrderPrice && needSwap){
      //     console.log(`   [${orderId}] Correct`)
      //   }
      // }
      // if (order._tokenIn.name == 'WETH') {
      // }
    }
  }
  // CALC TIME LAG
  console.log(`Минимальное время ордера ${getReadebleTimestamp(arrayMin(orderTimestamps))}. Максимальное ${getReadebleTimestamp(arrayMax(orderTimestamps))}`)
  console.log(`Ордера [C]`)
  //#region PREPARING
  acceptableTokensArrayLength = Number(await payerV3.acceptableTokensArrayLength());


  for (let i = 0; i < acceptableTokensArrayLength; i++) {
    const acceptableTokenAddress = await payerV3.acceptableTokensArray(i)
    acceptableTokensArray.push(acceptableTokenAddress)
    if (await payerV3.isUsdToken(acceptableTokenAddress)) {
      usdTokens.push(acceptableTokenAddress.toLowerCase())
      additionalAmounts.push({ token: acceptableTokenAddress.toLowerCase(), additionalAmount: 0, payerBalance: await payerV3.balanceOf(acceptableTokenAddress, payerAddress1) })
    }

  }
  // check Payer address balances

  for (let i = 0; i < orderIds.length; i++) {
    const orderId = contractParams._params[0][i]
    const additionalAmount = contractParams._params[2][i]
    const order = contractOrders[orderId]
    let payToken = order.tokenIn
    if (isUsdTokenCheck(order.tokenIn)) {
      payToken = order.tokenIn
    }
    if (isUsdTokenCheck(order.tokenOut)) {
      payToken = order.tokenOut
    }
    if (payToken == '0x0') {
      console.log(order)
    }
    const finded = additionalAmounts.find((o) => o.token == payToken.toLowerCase())
    finded.additionalAmount += Number(additionalAmount)
  }
  console.log(`Нужно выплатить всего: ${sum} USD`)
  console.log(`[${networkName}] Выплаты пользователям:`)
  for (const additionalAmountToken of additionalAmounts) {
    const additionalToken = replaceAddress(additionalAmountToken.token)
    console.log(`${additionalToken.short} ${readableTokenAmount(additionalToken, additionalAmountToken.additionalAmount)} Доступно ${readableTokenAmount(additionalToken, additionalAmountToken.payerBalance)}`)
  }
  for (let i = 0; i < acceptableTokensArray.length; i++) {
    //if (!balances[acceptableTokensArray[i]]) balances[acceptableTokensArray[i]] = {};
    //balances[acceptableTokensArray[i]][payerAddress] = await payerV3.balanceOf(acceptableTokensArray[i], payerAddress);

    for (let j = 0; j < acceptableTokensArray.length; j++) {

      if (acceptableTokensArray[i] === acceptableTokensArray[j]) continue;
      if (!swapsIn[acceptableTokensArray[i]]) swapsIn[acceptableTokensArray[i]] = {};
      if (!swapsOut[acceptableTokensArray[i]]) swapsOut[acceptableTokensArray[i]] = {};
      swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] = bn(0);
      swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = bn(0);
    }

    for (let k = 0; k < orderIds.length; k++) {
      // const order = await payerV3.orders(orderIds[k]);
      //balances[acceptableTokensArray[i]][order.user] = await payerV3.balanceOf(acceptableTokensArray[i], order.user);
    }
  }

  const _params = {
    orderIds: contractParams._params[0],
    swap: contractParams._params[1],
    additionalAmount: contractParams._params[2],
  };
  //#endregion

  await emulateExecution(
    _params,
    contractParams._amountOutMinimum,
    contractParams._claimOrders,
    contractParams._usdClaimToken
  );
}

async function emulateExecution(_params, _amountOutMinimum, _claimOrders, _usdClaimToken) {
  console.log(`Эмуляция вызова функции [C]`)

  const orderIdsLength = _params.orderIds.length;

  if (!(orderIdsLength == _params.swap.length && _params.swap.length == _params.additionalAmount.length)) {
    revert('DifferentLength()');
  }

  for (let i = 0; i < orderIdsLength; i++) {
    const orderId = _params.orderIds[i]
    const order = makeReadable(filterTextKeys(await payerV3.orders(orderId)))

    if (!(block.timestamp >= order.endTimestamp)) {
      revert(`WrongExpirationTime(${orderId})`);
    }
    if (order.claimed) {
      revert(`OrderAlreadyClaimed(${orderId})`);
    }
    if (order.completed) {
      revert(`OrderAlreadyCompleted(${orderId})`);
    }
    if (_params.swap[i]) {

      swapsIn[order.tokenIn][order.tokenOut] = swapsIn[order.tokenIn][order.tokenOut].add(
        bn(order.amountIn.toString())
      )
      console.log(`[${_params.orderIds[i]}] SWAP ${order._tokenIn.short} ==> ${order._tokenOut.short} +${order.amountIn}`)
      console.log(`updated swapIn: ${order._tokenIn.short} ==> ${order._tokenOut.short} = ${swapsIn[order.tokenIn][order.tokenOut].toString()}`)
    }
  }
  console.log(`Uniswap обмены [C]`)
  let swapsCount = 0
  for (let i = 0; i < acceptableTokensArrayLength; i++) {
    for (let j = 0; j < acceptableTokensArrayLength; j++) {
      const swapInAmount = swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]]
      if (swapInAmount > 0) {
        console.log(`   ${replaceAddress(acceptableTokensArray[i]).short} ==> ${replaceAddress(acceptableTokensArray[j]).short} = ${readableTokenAmount(replaceAddress(acceptableTokensArray[i]), swapInAmount)} (${swapInAmount})}`)
        swapsCount++
      }
    }
  }
  if (_amountOutMinimum.length != swapsCount) {
    console.log(`!Всего ${swapsCount} swap. Передали _amountOutMinimum ${_amountOutMinimum.length} значений`)
  }
  swapsCount = 0;
  for (let i = 0; i < acceptableTokensArrayLength; i++) {
    for (let j = 0; j < acceptableTokensArrayLength; j++) {
      const swapInAmount = swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]]
      if (swapInAmount > 0) {
        console.log(`   SWAP ${replaceAddress(acceptableTokensArray[i]).name} => ${replaceAddress(acceptableTokensArray[j]).name}`)
        let amountOut = ''
        const tokenIn = replaceAddress(acceptableTokensArray[i])
        const tokenOut = replaceAddress(acceptableTokensArray[j])
        if (tokenIn.name == 'WBTC') {
          amountOut = swapInAmount.mul(btcPrice).div(10 ** tokenIn.decimals)
        }
        if (tokenIn.name == 'WETH') {
          amountOut = swapInAmount.div(10 ** 8).mul(ethPrice).div(10 ** 10)
        }
        if (isUsdTokenCheck(tokenIn.address) && tokenOut.name == 'WBTC') {
          amountOut = swapInAmount.mul(10 ** tokenOut.decimals).div(btcPrice)
        }
        if (isUsdTokenCheck(tokenIn.address) && tokenOut.name == 'WETH') {
          amountOut = swapInAmount.mul(10 ** 10).div(ethPrice).mul(1e8)
        }
        console.log(`   Получим при обмене (amountOut) ~${readableTokenAmount(tokenOut, amountOut)} (${amountOut})`);
        console.log(`   Минимум который хотели получить (amountOutMinimum) ${readableTokenAmount(tokenOut, _amountOutMinimum[swapsCount])} (${_amountOutMinimum[swapsCount]})`);
        console.log(`   Обменяли больше чем минимально ожидаемое? ${amountOut.gt(bn(_amountOutMinimum[swapsCount]))}`)
        if (!amountOut.gt(bn(_amountOutMinimum[swapsCount]))) {
          //!
          revert(`IncorrectAmountOut(swapsCount: ${swapsCount} = ${_amountOutMinimum[swapsCount]})`);
        }
        swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = amountOut;
        swapsCount++;
      }
    }
  }
  for (let i = 0; i < orderIdsLength; i++) {
    await _executeOrder(_params.orderIds[i], _params.swap[i], _params.additionalAmount[i]);
  }
  console.log(`All Done!`)
}

async function _executeOrder(orderId, swap, additionalAmount) {
  console.log(`Исполняем ордер [${orderId}] ${swap ? '(need swap)' : ''}`)
  const order = makeReadable(filterTextKeys(await payerV3.orders(orderId)))
  order.additionalAmount = additionalAmount
  order.completed = true
  order.amountIn = bn(order.amountIn)
  const tokenIn = replaceAddress(order.tokenIn)
  const tokenOut = replaceAddress(order.tokenOut)
  if (swap) {
    const accuracy =
      wethAddress == order.tokenOut.toLowerCase() ? bn(1e10) : bn(10 ** tokenOut.decimals)
    // console.log('accuracy', accuracy)
    // console.log('total', swapsIn[order.tokenIn][order.tokenOut])
    // console.log('order.amountIn', order.amountIn)
    // console.log(calculateProportion(swapsIn[order.tokenIn][order.tokenOut], order.amountIn, accuracy))
    const proportionIn = bn(calculateProportion(swapsIn[order.tokenIn][order.tokenOut], order.amountIn, accuracy))
    const swapAmountOut = bn(swapsOut[order.tokenIn][order.tokenOut].mul(accuracy).div(proportionIn));
    console.log(`   Доля пользователя от общей суммы свапа ${readableTokenAmount(tokenOut, swapsOut[order.tokenIn][order.tokenOut])} составляет ${readableTokenAmount(tokenOut, swapAmountOut)} до вычета остатка`)
    let remainder
    const isUsdToken = isUsdTokenCheck(order.tokenIn)
    if (isUsdToken) {
      remainder = swapAmountOut - (order.amountIn * 10 ** tokenOut.decimals) / order.price;
      if (!(order.additionalAmount < calculatePercentage(order.amountIn, maxAdditionalAmountPercentage))) {
        revert('WrongAdditionalAmount()')
      }
    } else {
      // remainder = swapAmountOut - (order.amountIn * order.price) / 10 ** tokenOut.decimals
      if (tokenIn.name == 'WETH') {
        remainder = swapAmountOut.sub(order.amountIn.div(10 ** 8).mul(order.price).div(10 ** 10)) //TODO CHECK IT OVERFLOW ETH SWAP
      } else {
        // console.log(swapAmountOut, order.amountIn, order.price, 10 ** tokenIn.decimals)
        remainder = swapAmountOut.sub(order.amountIn.mul(order.price).div(10 ** tokenIn.decimals))
      }

      if (!(order.additionalAmount < calculatePercentage(swapAmountOut - remainder, maxAdditionalAmountPercentage))) {
        revert('WrongAdditionalAmount()')
      }
    }
    if (remainder < 0) console.log(`remainder не может быть отрицательным!`)
    console.log(`   Свапнули средства пользователя на ${readableTokenAmount(tokenOut, swapAmountOut)} (${swapAmountOut}) ${tokenOut.short}`)
    console.log(`   Пользователь получит ${readableTokenAmount(tokenOut, swapAmountOut - remainder)} (${swapAmountOut - remainder}) ${tokenOut.short} +${convertTokenAmount(additionalAmount, 6)} USD`)
    console.log(`   Разницу забираем ${readableTokenAmount(tokenOut, remainder)} (${remainder}) ${tokenOut.short}`)

  } else {
    order.tokenOut = order.tokenIn
    order.amountOut = order.amountIn
    console.log(`   Пользователь получит ${readableTokenAmount(tokenIn, order.amountOut)} (${order.amountOut}) ${tokenIn.short} +${convertTokenAmount(additionalAmount, 6)} USD`)
  }
}


function calculateProportion(_quantity, _total, _accuracy) {
  return safeDiv(_quantity.mul(_accuracy), _total)
}

function calculatePercentage(_quantity, _percentage) {
  return _quantity * _percentage / 10000
}

function revert(msg) {
  console.log(`Reverted ${msg}`)
  // process.exit()
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
function arrayMin(arr) {
  return arr.reduce(function (p, v) {
    return (p < v ? p : v)
  });
}

function arrayMax(arr) {
  return arr.reduce(function (p, v) {
    return (p > v ? p : v)
  });
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
