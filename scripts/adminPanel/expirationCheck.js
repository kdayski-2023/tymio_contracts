const { color, log, bold, bgCyan, bgGreen, bgGreenBright, white, magenta, red, green, cyan, cyanBright } = require('console-log-colors');
const { filterTextKeys, getNetworkName, makeReadable, convertTokenAmount, readableTokenAmount, IERC20, IERC20Metadata, replaceAddress } = require('../helpers/web3');

const ethPrice = 3543 * 1000000 // TODO GET DINAMIC FROM BCH
const btcPrice = 68000 * 1000000
const contractParamsAll = {
  1: { _params: [[], [], []], _amountOutMinimum: [], _claimOrders: false, _usdClaimToken: '' },
  42161: { _params: [[], [], []], _amountOutMinimum: [], _claimOrders: false, _usdClaimToken: '' },
  80001: { _params: [[], [], []], _amountOutMinimum: [], _claimOrders: false, _usdClaimToken: '' },
  421614: {
    _params: [[59], [true], ['67528591']],
    _amountOutMinimum: ['9064705'],
    _claimOrders: false,
    _usdClaimToken: '0x1DDC824D3af1f7d6c13eE9307817111A75D04520',
  },
};
const deployments = require('../../deployments');

const bn = ethers.BigNumber.from;
let payerV3,
  block,
  acceptableTokensArrayLength,
  networkName,
  ISwapRouter,
  poolFee,
  swapDeadline,
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
  // wethAddress = await payerV3.wethAddress();
  // maxAdditionalAmountPercentage = await payerV3.maxAdditionalAmountPercentage();
  payerAddress = await payerV3.payerAddress();
  const contractParams = contractParamsAll[chainId];
  console.log(bgCyan(`Параметры вызова функции [B]`))
  console.log(contractParams)
  const orderIds = contractParams._params[0];
  const contractOrders = {}
  console.log(bgCyan(`Что должны сделать [B]`))
  for (let i = 0; i < orderIds.length; i++) {
    const orderId = contractParams._params[0][i]
    const order = makeReadable(filterTextKeys(await payerV3.orders(orderId)))
    contractOrders[orderId] = order
    // TODO Написать понятным текстом вывод в консоль чего хотел пользователь и по какой цене
    const needSwap = contractParams._params[1][i]
    let amountTxt = ''
    if (needSwap) {
      amountTxt = `SWAP ${order.amountIn} ${order._tokenIn.short} ==> ${order._tokenOut.short}`
    } else {
      amountTxt = `==> ${order.amountIn} ${order._tokenIn.short}`
    }
    const additionalAmount = convertTokenAmount(contractParams._params[2][i], 6)
    console.log(`[${orderId}] ${amountTxt} + ${additionalAmount} usd`)

  }
  console.log(bgGreen(`Ордера [C]`))
  console.log(contractOrders)
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
  for (let i = 0; i < acceptableTokensArrayLength; i++) {
    for (let j = 0; j < acceptableTokensArrayLength; j++) {
      const swapInAmount = swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]]
      if (swapInAmount > 0) {
        console.log(`${replaceAddress(acceptableTokensArray[i]).short} ==> ${replaceAddress(acceptableTokensArray[j]).short} = ${readableTokenAmount(replaceAddress(acceptableTokensArray[i]), swapInAmount)} (${swapInAmount})}`)
      }
    }
  }
  let swapsCount = 0;
  for (let i = 0; i < acceptableTokensArrayLength; i++) {
    for (let j = 0; j < acceptableTokensArrayLength; j++) {
      const swapInAmount = swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]]
      if (swapInAmount > 0) {

        console.log(`SWAP ${replaceAddress(acceptableTokensArray[i]).name} => ${replaceAddress(acceptableTokensArray[j]).name}`)
        let amountOut = ''
        const tokenIn = replaceAddress(acceptableTokensArray[i])
        const tokenOut = replaceAddress(acceptableTokensArray[j])
        if (tokenIn.name == 'WBTC') {
          amountOut = swapInAmount.mul(btcPrice).div(10 ** tokenIn.decimals)
        }
        if (tokenIn.name == 'WETH') {
          amountOut = swapInAmount.mul(ethPrice).div(10 ** tokenIn.decimals)
        }
        if (tokenIn.name == 'USDC' && tokenOut.name == 'WBTC') {
          amountOut = swapInAmount.mul(10 ** tokenOut.decimals).div(btcPrice)
        }
        if (tokenIn.name == 'USDC' && tokenOut.name == 'WETH') {
          amountOut = swapInAmount.mul(10 ** tokenOut.decimals).div(ethPrice)
        }
        console.log(`Получим при обмене (amountOut) ~${readableTokenAmount(tokenOut, amountOut)} (${amountOut})`);
        console.log(`Минимум который хотели получить (amountOutMinimum) ${readableTokenAmount(tokenOut, _amountOutMinimum[swapsCount])} (${_amountOutMinimum[swapsCount]})`);
        console.log(`Обменяли больше чем минимально ожидаемое? ${amountOut.gt(bn(_amountOutMinimum[swapsCount]))}`)
        603000000000
        6390000000
        if (!amountOut.gt(bn(_amountOutMinimum[swapsCount]))) {
          revert(`IncorrectAmountOut(${swapsCount} - ${_amountOutMinimum[swapsCount]})`);
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
  console.log('_executeOrder', { orderId, swap, additionalAmount })
  const order = await payerV3.orders(orderId)
  order.additionalAmount = additionalAmount
  order.completed = true
  if (swap) {
    const tokenIn = replaceAddress(order.tokenIn)
    const tokenOut = replaceAddress(order.tokenOut)
    const accuracy =
      wethAddress == order.tokenOut ? 1e10 : 10 ** tokenOut.decimals
    const proportionIn = bn(calculateProportion(swapsIn[order.tokenIn][order.tokenOut], order.amountIn, accuracy))
    const swapAmountOut = bn(swapsOut[order.tokenIn][order.tokenOut].mul(accuracy).div(proportionIn));
    console.log(`Доля пользователя ${proportionIn / 10 ** tokenOut.decimals * 100}% от общей суммы ${readableTokenAmount(tokenOut, swapsOut[order.tokenIn][order.tokenOut])} составляет ${readableTokenAmount(tokenOut, swapAmountOut)}`)
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
      remainder = swapAmountOut.sub(order.amountIn.mul(order.price).div(10 ** tokenIn.decimals))
      if (!(order.additionalAmount < calculatePercentage(swapAmountOut - remainder, maxAdditionalAmountPercentage))) {
        revert('WrongAdditionalAmount()')
      }
    }
    if (remainder < 0) console.log(red(`remainder не может быть отрицательным!`))
    console.log(`Свапнули средства пользователя на ${readableTokenAmount(tokenOut, swapAmountOut)} (${swapAmountOut}) ${tokenOut.short}`)
    console.log(`Пользователь получит ${readableTokenAmount(tokenOut, swapAmountOut - remainder)} (${swapAmountOut - remainder}) ${tokenOut.short} +${convertTokenAmount(additionalAmount, 6)} USD`)
    console.log(`Разницу забираем ${readableTokenAmount(tokenOut, remainder)} ${tokenOut.short}`)

  } else {
    order.tokenOut = order.tokenIn
    order.amountOut = order.amountIn
    console.log(`Пользователь получит ${readableTokenAmount(tokenIn, order.amountOut)} (${order.amountOut}) ${tokenIn.short} +${convertTokenAmount(additionalAmount, 6)} USD`)
  }
}


function calculateProportion(_quantity, _total, _accuracy) {
  return (_quantity * _accuracy) / _total
}

function calculatePercentage(_quantity, _percentage) {
  return (_quantity * _percentage) / 10000
}

function revert(msg) {
  console.log(red(`Reverted ${msg}`))
  // process.exit()
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
