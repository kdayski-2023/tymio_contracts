const { DECIMALS } = require('./contants');
const { cToken, roudToDecimals } = require('./utils');
const { getAcceptableTokens, getOrder } = require('./contract');

async function getSwapsOut(payer, args, prices, tokensV3) {
  const swapsIn = {};
  const swapsOut = {};
  const acceptableTokensArray = await getAcceptableTokens(payer);
  const params = {
    orderIds: args[0],
    swap: args[1],
    additionalAmount: args[2],
  };

  if (
    params.orderIds.length !== params.swap.length ||
    params.swap.length !== params.additionalAmount.length
  )
    throw new Error('DIFFERENT LENGTH');

  // TODO Поделка дошкольника
  for (let i = 0; i < acceptableTokensArray.length; i++) {
    for (let j = 0; j < acceptableTokensArray.length; j++) {
      if (acceptableTokensArray[i] === acceptableTokensArray[j]) continue;
      if (!swapsIn[acceptableTokensArray[i]])
        swapsIn[acceptableTokensArray[i]] = {};
      if (!swapsOut[acceptableTokensArray[i]])
        swapsOut[acceptableTokensArray[i]] = {};
      swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] = 0;
      swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = 0;
    }
  }
  // TODO
  for (let i = 0; i < params.orderIds.length; i++) {
    if (params.swap[i]) {
      const order = await getOrder(payer, params.orderIds[i]);
      // require(block.timestamp >= order.endTimestamp, "WRONG EXPIRATION TIME");
      if (!swapsIn[order.tokenIn]) {
        swapsIn[order.tokenIn] = {};
        swapsIn[order.tokenIn][order.tokenOut] = parseFloat(
          cToken(order.amountIn, tokensV3[order.tokenIn])
        );
      } else {
        swapsIn[order.tokenIn][order.tokenOut] =
          swapsIn[order.tokenIn][order.tokenOut] +
          parseFloat(cToken(order.amountIn, tokensV3[order.tokenIn]));
      }
      // TODO Поделка дошкольника
      const isUsd = await payer.isUsdToken(order.tokenIn);
      if (isUsd) {
        swapsOut[order.tokenIn][order.tokenOut] =
          swapsOut[order.tokenIn][order.tokenOut] +
          prices[tokensV3[order.tokenOut]] /
            parseFloat(cToken(order.amountIn, tokensV3[order.tokenIn]));
      } else {
        swapsOut[order.tokenIn][order.tokenOut] =
          swapsOut[order.tokenIn][order.tokenOut] +
          parseFloat(cToken(order.amountIn, tokensV3[order.tokenIn])) *
            prices[tokensV3[order.tokenIn]];
      }
      // TODO
    }
  }
  console.log(swapsIn);
  console.log(swapsOut);
  // TODO Поделка дошкольника
  for (let i = 0; i < acceptableTokensArray.length; i++) {
    for (let j = 0; j < acceptableTokensArray.length; j++) {
      if (swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] > 0) {
        const tokenIn = acceptableTokensArray[i];
        const tokenOut = acceptableTokensArray[j];
        const amount = swapsOut[tokenIn][tokenOut];
        12066.63333785;
        swapsOut[tokenIn][tokenOut] = roudToDecimals(
          amount - (amount / 100) * 5,
          DECIMALS[tokensV3[tokenOut]]
        );
      }
    }
  }
  // TODO
  console.log(swapsOut);
  let swapsCount = 0;
  for (let i = 0; i < acceptableTokensArray.length; i++) {
    for (let j = 0; j < acceptableTokensArray.length; j++) {
      if (swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] > 0) {
        const swapParams = {
          tokenIn: acceptableTokensArray[i],
          tokenOut: acceptableTokensArray[j],
          amountIn: swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]],
          // TODO
          amountOutMinimum:
            swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]],
          sqrtPriceLimitX96: 0,
        };
        console.log(swapParams);
        // const swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = amountOut;
        swapsCount++;
      }
    }
  }

  // for (const order of expiration.orders) {
  //   args[0].push(order.contract_id);
  //   args[1].push(order.order_executed);
  //   args[2].push(sToken(order.additionalAmount, 'USDC'));
  //   if (order.order_executed) {
  //     const tokenInSymbol = tokensV1[order.tokenIn];
  //     const tokenInAddress = tokensV3[tokenInSymbol].address;
  //     const tokenOutSymbol = tokensV1[order.tokenOut];
  //     const tokenOutAddress = tokensV3[tokenOutSymbol].address;
  //     if (!swapsOut[tokenInAddress]) {
  //       swapsOut[tokenInAddress] = {};
  //       swapsOut[tokenInAddress][tokenOutAddress] = order.amountOut;
  //     } else {
  //       swapsOut[tokenInAddress][tokenOutAddress] =
  //         swapsOut[tokenInAddress][tokenOutAddress] + order.amountOut;
  //     }
  //     swapAmount[order.targetTokenSymbolOut] =
  //       swapAmount[order.targetTokenSymbolOut] + order.amountOut;
  //   }
  // }
}
