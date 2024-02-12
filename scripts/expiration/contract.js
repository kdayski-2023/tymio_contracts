const { log, sToken, thowDotPart } = require('./utils');

async function setSwapRouter(payer, swapRouter) {
  try {
    tx = await payer.setSwapRouter(swapRouter.address);
    await tx.wait();
    log('✔ [contract] Swap router установлен', 'yellow', true);
  } catch (e) {
    throw e;
  }
}

async function setWeth(payer, tokens) {
  try {
    tx = await payer.setWeth(tokens['WETH'].address);
    await tx.wait();
    log('✔ [contract] WETH установлен', 'yellow');
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

    log('✔ [contract] Принимаемые контрактом токены установлены', 'yellow');
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
    log('✔ [expiration] Цены токенов на основе экспирации', 'green');
    const usdWbtcPrice = thowDotPart(sToken(1, 'WBTC') / prices['WBTC']); // цена 1 usd к btc
    const wbtcUsdPrice = sToken(prices['WBTC'], 'USD'); // цена 1 btc к usd
    const ethUsdPrice = sToken(prices['WETH'], 'USD'); // цена 1 eth к usd
    const usdEthPrice = thowDotPart(sToken(1, 'WETH') / prices['WETH']); // цена 1 usd к eth
    log(prices);
    log({ usdWbtcPrice, wbtcUsdPrice, ethUsdPrice, usdEthPrice });
    tx = await swapRouter.setRatio(
      tokens['USDC'].address,
      tokens['WETH'].address,
      usdEthPrice
    );
    await tx.wait();
    log('✔ [contract] Курс обмена USDC -> WETH установлен', 'yellow');
    tx = await swapRouter.setRatio(
      tokens['WETH'].address,
      tokens['USDC'].address,
      ethUsdPrice
    );
    await tx.wait();
    log('✔ [contract] Курс обмена WETH -> USDC установлен', 'yellow');
    if (prices['WBTC']) {
      tx = await swapRouter.setRatio(
        tokens['WBTC'].address,
        tokens['USDC'].address,
        wbtcUsdPrice
      );
      await tx.wait();
      log('✔ [contract] Курс обмена WBTC -> USDC установлен', 'yellow');
      tx = await swapRouter.setRatio(
        tokens['USDC'].address,
        tokens['WBTC'].address,
        usdWbtcPrice
      );
      await tx.wait();
      log('✔ [contract] Курс обмена USDC -> WBTC установлен', 'yellow');
    }
  } catch (e) {
    throw e;
  }
}

module.exports = {
  setRatio,
  setAcceptableTokens,
  setSwapRouter,
  setWeth,
  setPayerAddress,
};
