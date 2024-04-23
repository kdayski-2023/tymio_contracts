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
  // ISwapRouter = await ethers.getContractAt('TestSwapRouter', deployments.networks[networkName].swapRouter);
  // poolFee = await payerV3.poolFee();
  //! TODO swapDeadline должен быть публичным
  //   swapDeadline = await payerV3.swapDeadline();
  // swapDeadline = bn(10 * 60 * 1000);
  wethAddress = await payerV3.wethAddress()
  payerAddress1 = await payerV3.payerAddress()
  console.log(payerAddress1)
  wethAddress = wethAddress.toLowerCase()
  maxAdditionalAmountPercentage = await payerV3.maxAdditionalAmountPercentage()
  payerAddress = await payerV3.payerAddress();
  const contractParams = contractParamsAll[chainId];
  console.log(bgCyan(`Параметры вызова функции [B]`))
  console.log(contractParams._usdClaimToken)
  const orderIds = contractParams._params[0];
  const contractOrders = {}
  const sum = contractParams._params[2].reduce((partialSum, a) => Number(partialSum) + Number(a), 0)
  console.log(contractParams)
  console.log(`Need balance: ${sum}`)
  console.log(`Avalible balance: ${await payerV3.balanceOf(contractParams._usdClaimToken, payerAddress1)}`)

  console.log(bgCyan(`Что должны сделать [B]`))
  for (let i = 0; i < orderIds.length; i++) {
    const orderId = contractParams._params[0][i]
    const order = makeReadable(filterTextKeys(await payerV3.orders(orderId)))
    contractOrders[orderId] = order
    // TODO Написать понятным текстом вывод в консоль чего хотел пользователь и по какой цене
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
  console.log(bgGreen(`Ордера [C]`))
  // console.log(contractOrders)
  // console.log(bgGreen(`Проверка корректности цен [C]`)) // TODO
  for (let [index, order] of Object.entries(contractOrders)) {

  }
  //#region PREPARING
  acceptableTokensArrayLength = Number(await payerV3.acceptableTokensArrayLength());

  for (let i = 0; i < acceptableTokensArrayLength; i++) {
    acceptableTokensArray.push(await payerV3.acceptableTokensArray(i));
  }

  for (let i = 0; i < acceptableTokensArray.length; i++) {
    if (!balances[acceptableTokensArray[i]]) balances[acceptableTokensArray[i]] = {};
    balances[acceptableTokensArray[i]][payerAddress] = await payerV3.balanceOf(acceptableTokensArray[i], payerAddress);

    for (let j = 0; j < acceptableTokensArray.length; j++) {
      if (acceptableTokensArray[i] === acceptableTokensArray[j]) continue;
      if (!swapsIn[acceptableTokensArray[i]]) swapsIn[acceptableTokensArray[i]] = {};
      if (!swapsOut[acceptableTokensArray[i]]) swapsOut[acceptableTokensArray[i]] = {};
      swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] = bn(0);
      swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = bn(0);
    }

    for (let k = 0; k < orderIds.length; k++) {
      const order = await payerV3.orders(orderIds[k]);
      balances[acceptableTokensArray[i]][order.user] = await payerV3.balanceOf(acceptableTokensArray[i], order.user);
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
  console.log(bgGreen(`Эмуляция вызова функции [C]`))

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
  console.log(bgGreen(`Uniswap обмены [C]`))
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
    console.log(red(`Всего ${swapsCount} swap. Передали _amountOutMinimum ${_amountOutMinimum.length} значений`))
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
        if (tokenIn.name == 'USDC' && tokenOut.name == 'WBTC') {
          amountOut = swapInAmount.mul(10 ** tokenOut.decimals).div(btcPrice)
        }
        if (tokenIn.name == 'USDC' && tokenOut.name == 'WETH') {
          amountOut = swapInAmount.mul(10 ** 10).div(ethPrice).mul(1e8)
        }
        console.log(`   Получим при обмене (amountOut) ~${readableTokenAmount(tokenOut, amountOut)} (${amountOut})`);
        console.log(`   Минимум который хотели получить (amountOutMinimum) ${readableTokenAmount(tokenOut, _amountOutMinimum[swapsCount])} (${_amountOutMinimum[swapsCount]})`);
        console.log(`   Обменяли больше чем минимально ожидаемое? ${amountOut.gt(bn(_amountOutMinimum[swapsCount]))}`)
        if (!amountOut.gt(bn(_amountOutMinimum[swapsCount]))) {
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
  if (_claimOrders) {
    for (let i = 0; i < orderIdsLength; i++) {
      // claimOrder(_params.orderIds[i], _usdClaimToken, false);
    }
  }

}

async function _executeOrder(orderId, swap, additionalAmount) {
  // TODO
  console.log(bgGreen(`Исполняем ордер [${orderId}] ${swap ? '(need swap)' : ''}`))
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
    const isUsdToken = await payerV3.isUsdToken(order.tokenIn)
    // console.log(`isUsdToken ${tokenIn.short} ${isUsdToken}`)
    if (isUsdToken) {
      remainder = swapAmountOut - (order.amountIn * 10 ** tokenOut.decimals) / order.price;
      if (!(order.additionalAmount < calculatePercentage(order.amountIn, maxAdditionalAmountPercentage))) {
        revert('WrongAdditionalAmount()')
      }
    } else {
      // remainder = swapAmountOut - (order.amountIn * order.price) / 10 ** tokenOut.decimals
      // if (tokenIn.name == 'WETH') {
      // remainder = swapAmountOut.sub(order.amountIn.div(10 ** 8).mul(order.price).div(10 ** 10)) //TODO CHECK IT OVERFLOW ETH SWAP
      // } else {
      remainder = swapAmountOut.sub(order.amountIn.mul(order.price).div(10 ** tokenIn.decimals))
      // }

      if (!(order.additionalAmount < calculatePercentage(swapAmountOut - remainder, maxAdditionalAmountPercentage))) {
        revert('WrongAdditionalAmount()')
      }
    }
    if (remainder < 0) console.log(red(`remainder не может быть отрицательным!`))
    console.log(`   Свапнули средства пользователя на ${readableTokenAmount(tokenOut, swapAmountOut)} (${swapAmountOut}) ${tokenOut.short}`)
    console.log(`   Пользователь получит ${readableTokenAmount(tokenOut, swapAmountOut - remainder)} (${swapAmountOut - remainder}) ${tokenOut.short} +${convertTokenAmount(additionalAmount, 6)} USD`)
    console.log(`   Разницу забираем ${readableTokenAmount(tokenOut, remainder)} ${tokenOut.short}`)

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
  console.log(red(`Reverted ${msg}`))
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
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
