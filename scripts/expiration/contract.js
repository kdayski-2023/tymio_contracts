const { DECIMALS } = require('./contants');
const { log, sToken, thowDotPart, cToken, roudToDecimals } = require('./utils');

async function setSwapRouter(payer, swapRouter) {
  try {
    tx = await payer.setSwapRouter(swapRouter.address);
    await tx.wait();
    log('✔ [contract] Swap router установлен', 'green');
  } catch (e) {
    throw e;
  }
}

async function setWeth(payer, tokens) {
  try {
    tx = await payer.setWeth(tokens['WETH'].address);
    await tx.wait();
    log('✔ [contract] WETH установлен', 'green');
  } catch (e) {
    throw e;
  }
}

async function setAcceptableTokens(payer, tokens) {
  try {
    tx = await payer.editAcceptableToken(tokens['USDC'].address, true, true);
    await tx.wait();
    tx = await payer.editAcceptableToken(tokens['WETH'].address, true, false);
    await tx.wait();
    tx = await payer.editAcceptableToken(tokens['WBTC'].address, true, false);
    await tx.wait();

    log('✔ [contract] Принимаемые контрактом токены установлены', 'green');
  } catch (e) {
    throw e;
  }
}

async function setPayerAddress(payer, payerAddress) {
  tx = await payer.setPayerAddress(payerAddress);
  tx = await tx.wait();
}

async function setRatio(swapRouter, tokens, prices) {
  try {
    const usdWbtcPrice = thowDotPart(sToken(1, 'WBTC') / prices['WBTC']); // цена 1 usd к btc
    const wbtcUsdPrice = sToken(prices['WBTC'], 'USD'); // цена 1 btc к usd
    const ethUsdPrice = sToken(prices['WETH'], 'USD'); // цена 1 eth к usd
    const usdEthPrice = thowDotPart(sToken(1, 'WETH') / prices['WETH']); // цена 1 usd к eth
    log('✔ [expiration] Цены токенов на основе экспирации', 'yellow');
    tx = await swapRouter.setRatio(
      tokens['USDC'].address,
      tokens['WETH'].address,
      usdEthPrice
    );
    await tx.wait();
    log('✔ [contract] Курс обмена USDC -> WETH установлен', 'green');
    tx = await swapRouter.setRatio(
      tokens['WETH'].address,
      tokens['USDC'].address,
      ethUsdPrice
    );
    await tx.wait();
    log('✔ [contract] Курс обмена WETH -> USDC установлен', 'green');
    if (prices['WBTC']) {
      tx = await swapRouter.setRatio(
        tokens['WBTC'].address,
        tokens['USDC'].address,
        wbtcUsdPrice
      );
      await tx.wait();
      log('✔ [contract] Курс обмена WBTC -> USDC установлен', 'green');
      tx = await swapRouter.setRatio(
        tokens['USDC'].address,
        tokens['WBTC'].address,
        usdWbtcPrice
      );
      await tx.wait();
      log('✔ [contract] Курс обмена USDC -> WBTC установлен', 'green');
    }
  } catch (e) {
    throw e;
  }
}

async function getAcceptableTokens(payer) {
  try {
    const acceptableTokensArray = [];
    let cnt = 0;
    while (true) {
      try {
        const token = await payer.acceptableTokensArray(cnt);
        acceptableTokensArray.push(token);
        cnt++;
      } catch (e) {
        break;
      }
    }
    return acceptableTokensArray;
  } catch (e) {
    throw e;
  }
}

async function getOrder(payer, id) {
  try {
    const token = await payer.orders(id);
    return token;
  } catch (e) {
    throw e;
  }
}

async function getSwapsOutMinimal(payer, args, prices, tokensV3) {
  const swapsIn = {};
  const swapsOut = {};
  const swapsOutMinimal = {};
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

  for (const [symbol, price] of Object.entries(prices)) {
    log(`[swap] Token price ${symbol}: ${price}`, 'blue');
  }

  // TODO Поделка дошкольника
  for (let i = 0; i < acceptableTokensArray.length; i++) {
    for (let j = 0; j < acceptableTokensArray.length; j++) {
      if (acceptableTokensArray[i] === acceptableTokensArray[j]) continue;
      if (!swapsIn[acceptableTokensArray[i]])
        swapsIn[acceptableTokensArray[i]] = {};
      if (!swapsOut[acceptableTokensArray[i]])
        swapsOut[acceptableTokensArray[i]] = {};
      if (!swapsOutMinimal[acceptableTokensArray[i]])
        swapsOutMinimal[acceptableTokensArray[i]] = {};
      swapsOutMinimal[acceptableTokensArray[i]][acceptableTokensArray[j]] = 0;
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
          parseFloat(cToken(order.amountIn, tokensV3[order.tokenIn])) /
            prices[tokensV3[order.tokenOut]];
      } else {
        swapsOut[order.tokenIn][order.tokenOut] =
          swapsOut[order.tokenIn][order.tokenOut] +
          parseFloat(cToken(order.amountIn, tokensV3[order.tokenIn])) *
            prices[tokensV3[order.tokenIn]];
      }
      // TODO
    }
  }
  log(``, 'blue', true);
  log(`[swap] Exact in`, 'blue', true);
  for (const [tokenIn, tokensOut] of Object.entries(swapsIn)) {
    log(`[swap][in] Token in ${tokensV3[tokenIn]}`, 'blue');
    for (const [tokenOut, amount] of Object.entries(tokensOut)) {
      log(`[swap][out] Token out ${tokensV3[tokenOut]}: ${amount}`, 'blue');
    }
  }
  log(``, 'blue', true);
  log(`[swap] Exact out before infelicity`, 'blue', true);
  for (const [tokenIn, tokensOut] of Object.entries(swapsOut)) {
    log(`[swap][in] Token in ${tokensV3[tokenIn]}`, 'blue');
    for (const [tokenOut, amount] of Object.entries(tokensOut)) {
      log(`[swap][out] Token out ${tokensV3[tokenOut]}: ${amount}`, 'blue');
    }
  }
  // TODO Поделка дошкольника
  for (let i = 0; i < acceptableTokensArray.length; i++) {
    for (let j = 0; j < acceptableTokensArray.length; j++) {
      if (swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] > 0) {
        const tokenIn = acceptableTokensArray[i];
        const tokenOut = acceptableTokensArray[j];
        const amount = swapsOut[tokenIn][tokenOut];
        swapsOutMinimal[tokenIn][tokenOut] = roudToDecimals(
          amount - (amount / 100) * 5,
          DECIMALS[tokensV3[tokenOut]]
        );
      }
    }
  }
  // TODO
  log(``, 'blue', true);
  log(`[swap] Exact out after infelicity`, 'blue', true);
  for (const [tokenIn, tokensOut] of Object.entries(swapsOutMinimal)) {
    log(`[swap][in] Token in ${tokensV3[tokenIn]}`, 'blue');
    for (const [tokenOut, amount] of Object.entries(tokensOut)) {
      log(`[swap][out] Token out ${tokensV3[tokenOut]}: ${amount}`, 'blue');
    }
  }
  let swapsCount = 0;
  for (let i = 0; i < acceptableTokensArray.length; i++) {
    for (let j = 0; j < acceptableTokensArray.length; j++) {
      if (swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] > 0) {
        const tokenIn = acceptableTokensArray[i];
        const tokenOut = acceptableTokensArray[j];
        const amountIn =
          swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]];
        const amountOutDesired =
          swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]];
        const amountOutMinimum =
          swapsOutMinimal[acceptableTokensArray[i]][acceptableTokensArray[j]];
        log(``, 'blue', true);
        log(
          `[swap][${tokensV3[tokenIn]} -> ${tokensV3[tokenOut]}] Amount in: ${amountIn} | Amount out desired: ${amountOutDesired} | Amount out minimum: ${amountOutMinimum}`,
          'blue',
          true
        );
        const swapParams = {
          tokenIn,
          tokenOut,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: 0,
        };
        // const swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = amountOut;
        swapsCount++;
      }
    }
  }
  return swapsOutMinimal;
}

module.exports = {
  setRatio,
  setAcceptableTokens,
  setSwapRouter,
  setWeth,
  setPayerAddress,
  getAcceptableTokens,
  getSwapsOutMinimal,
};
