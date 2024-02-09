const { DECIMALS } = require('./contants');
const { log, sToken, thowDotPart } = require('./utils');

async function setSwapRouter(payer, swapRouter) {
  try {
    log('Установка swap router', 'blue', true);

    tx = await payer.setSwapRouter(swapRouter.address);
    await tx.wait();
    log('✔ Swap router установлен', 'green', true);
  } catch (e) {
    throw e;
  }
}

async function setWeth(payer, tokens) {
  try {
    log('Установка WETH адреса', 'blue', true);

    tx = await payer.setWeth(tokens['WETH'].address);
    await tx.wait();
    log('✔ WETH установлен', 'green', true);
  } catch (e) {
    throw e;
  }
}

async function setAcceptableTokens(payer, tokens) {
  try {
    log('Установка принимаемых контрактом токенов', 'blue', true);

    tx = await payer.editAcceptableToken(tokens['USDC'].address, true, true);
    await tx.wait();
    log('✔ USDC добавлен', 'green');
    tx = await payer.editAcceptableToken(tokens['WETH'].address, true, false);
    await tx.wait();
    log('✔ WETH добавлен', 'green');
    tx = await payer.editAcceptableToken(tokens['WBTC'].address, true, false);
    await tx.wait();
    log('✔ WBTC добавлен', 'green');

    log('✔ Принимаемые контрактом токены установлены', 'green', true);
  } catch (e) {
    throw e;
  }
}

async function setRatio(swapRouter, tokens, prices) {
  try {
    log('Настройка курса обмена', 'blue', true);
    log('✔ Цены токенов на основе экспирации', 'green');
    log(prices);
    const usdWbtcPrice = thowDotPart(sToken(1, 'WBTC') / prices['WBTC']); // цена 1 usd к btc
    const wbtcUsdPrice = sToken(prices['WBTC'], 'USD'); // цена 1 btc к usd
    const ethUsdPrice = sToken(prices['WETH'], 'USD'); // цена 1 eth к usd
    const usdEthPrice = thowDotPart(sToken(1, 'WETH') / prices['WETH']); // цена 1 usd к eth
    log('✔ Данные для установки курса обмена', 'green');
    console.log({ usdWbtcPrice, wbtcUsdPrice, ethUsdPrice, usdEthPrice });
    tx = await swapRouter.setRatio(
      tokens['USDC'].address,
      tokens['WETH'].address,
      usdEthPrice
    );
    await tx.wait();
    log('✔ Курс обмена USDC -> WETH установлен', 'green');
    tx = await swapRouter.setRatio(
      tokens['WETH'].address,
      tokens['USDC'].address,
      ethUsdPrice
    );
    await tx.wait();
    log('✔ Курс обмена WETH -> USDC установлен', 'green');
    tx = await swapRouter.setRatio(
      tokens['WBTC'].address,
      tokens['USDC'].address,
      wbtcUsdPrice
    );
    await tx.wait();
    log('✔ Курс обмена WBTC -> USDC установлен', 'green');
    tx = await swapRouter.setRatio(
      tokens['USDC'].address,
      tokens['WBTC'].address,
      usdWbtcPrice
    );
    await tx.wait();
    log('✔ Курс обмена USDC -> WBTC установлен', 'green');

    log('✔ Курс обмена настроен', 'green', true);
  } catch (e) {
    throw e;
  }
}

module.exports = {
  setRatio,
  setAcceptableTokens,
  setSwapRouter,
  setWeth,
};
