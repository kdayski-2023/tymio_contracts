const {
  log,
  cToken,
  convertFloatToBnString,
  sToken,
  wait,
  roudToDecimals,
} = require('./utils');
const { tokensV1, DECIMALS } = require('./contants');
const { getSwapsOutMinimal } = require('./contract');

function getAdditionalAmount(expiration) {
  try {
    // Сумма нагад
    let additionalAmountSum = 0;
    for (const order of expiration.orders) {
      // Аккумулируем комиссию
      additionalAmountSum += Number(order.additionalAmount);
    }
    additionalAmountSum = cToken(
      convertFloatToBnString(
        Math.round(additionalAmountSum * 10 ** DECIMALS.USDC) /
          10 ** DECIMALS.USDC,
        DECIMALS.USDC
      ),
      'USDC'
    );
    log(
      '✔ [expiration] Обязательства на выплату контрактом комиссии',
      'yellow'
    );
    return additionalAmountSum;
  } catch (e) {
    throw e;
  }
}

function getAmountToDeposit(expiration) {
  try {
    // Сумма минта токенов на контракт для выплаты обязательств
    const mintForContract = {
      USDC: 0,
      ETH: 0,
      WBTC: 0,
    };
    const mintForUsers = {
      USDC: {},
      ETH: {},
      WBTC: {},
    };
    for (const order of expiration.orders) {
      // Отдельно сумму взноса пользователем
      const tokenIn = tokensV1[order.tokenIn];
      const user = order.user;
      mintForUsers[tokenIn][user] =
        mintForUsers[tokenIn][user] || 0 + Number(order.amountIn);

      // Сумма обязательств в токене
      const tokenOut = tokensV1[order.tokenOut];
      mintForContract[tokenOut] = mintForContract[tokenOut] + order.amountOut;
    }
    log(
      `✔ [expiration] Обязательства взноса пользователями сформированы`,
      'yellow'
    );
    log(
      `✔ [expiration] Минимальные обязательства на выплату контрактом сформированы`,
      'yellow'
    );
    return { contract: mintForContract, users: mintForUsers };
  } catch (e) {
    throw e;
  }
}

async function replaceUserAddresses(expiration, users) {
  try {
    const usersObj = {};
    let cnt = 0;
    for (const [_, order] of expiration.orders.entries()) {
      if (usersObj[order.user]) continue;
      else {
        usersObj[order.user] = users[cnt];
        cnt++;
      }
    }
    for (const [_, order] of expiration.orders.entries()) {
      order.signer = usersObj[order.user];
      order.user = usersObj[order.user].address;
    }
    log(
      '✔ [modify] Замена реальных адресов пользователей на сгенерированны',
      'gray'
    );
    return expiration;
  } catch (e) {
    throw e;
  }
}

async function postOrders(payer, expiration, tokensV3) {
  try {
    const expirationDuration = 1;
    for (const order of expiration.orders) {
      const orderDuration = 1;
      const tokenInSymbol = tokensV1[order.tokenIn];
      const signer = order.signer;
      const amountIn = order.amountIn;
      const price = order.price;
      const payerAddress = payer.address;
      const targetTokenSymbolOut = order.targetTokenSymbolOut;
      const direction = order.direction === 'sell' ? 'продажу' : 'покупку';

      if (tokenInSymbol === 'ETH') {
        const _tokenAddressOut = tokensV3['USDC'].address;
        const _amount = sToken(amountIn, 'WETH');
        const _price = sToken(price, 'USDC');
        const _duration = orderDuration;
        const value = sToken(amountIn, 'ETH');

        tx = await payer
          .connect(signer)
          .depositEthAndOrder(_tokenAddressOut, _amount, _price, _duration, {
            value,
          });
        tx = await tx.wait();
      } else {
        const token = tokensV3[tokenInSymbol];
        const _tokenAddressIn = tokensV3[tokenInSymbol].address;
        const _tokenAddressOut = tokensV3[targetTokenSymbolOut].address;
        const _amount = sToken(amountIn, tokenInSymbol);
        const _price = sToken(price, 'USDC');
        const _duration = orderDuration;

        tx = await token.connect(signer).approve(payerAddress, _amount);
        tx = await tx.wait();
        tx = await payer
          .connect(signer)
          .depositAndOrder(
            _tokenAddressIn,
            _tokenAddressOut,
            _amount,
            _price,
            _duration
          );
        tx = await tx.wait();
      }
      for (const event of tx.events) {
        if (event.event === 'NewOrder') {
          order.contract_id = event.args.orderId.toString();
        }
      }
      log(
        `✔ [contract] Запись сделки ${order.contract_id} на ${direction} за ${price} USDC | ${amountIn} ${tokenInSymbol}`,
        'green'
      );
    }
    log(`✔ [info] Ждем ${expirationDuration} сек`, 'blue');
    await wait(expirationDuration);
    return expiration;
  } catch (e) {
    throw e;
  }
}

async function executeOrders(payer, expiration, tokensV3) {
  try {
    let args = [[], [], []];
    const swapAmount = { ETH: 0, USDC: 0, WBTC: 0 };
    for (const order of expiration.orders) {
      args[0].push(order.contract_id);
      args[1].push(order.order_executed);
      args[2].push(
        sToken(roudToDecimals(order.additionalAmount * 2, 6), 'USDC')
      );
      if (order.order_executed) {
        swapAmount[order.targetTokenSymbolOut] =
          swapAmount[order.targetTokenSymbolOut] + order.amountOut;
      }
    }
    const swapOutMinimal = await getSwapsOutMinimal(
      payer,
      args,
      expiration.prices,
      tokensV3
    );
    log(
      `[contract][info] Swap amount out USDC: ${swapAmount.USDC} | ETH: ${swapAmount.ETH} | WBTC: ${swapAmount.WBTC}`,
      'blue'
    );
    tx = await payer.executeOrders(args, swapOutMinimal);
    tx = await tx.wait();
    log('✔ [contract] Сделки исполнены', 'green');
  } catch (e) {
    throw e;
  }
}

async function claimOrders(payer, expiration, tokensV3) {
  try {
    for (const order of expiration.orders) {
      const id = order.contract_id;
      const user = order.signer;
      const claimTokenAddress = tokensV3['USDC'].address;
      tx = await payer.orders(id);
      tx = await payer.connect(user).claimOrder(id, claimTokenAddress, false);
      tx = await tx.wait();
      log(`✔ [contract][user] Клейм сделки ${id}`, 'green');
    }
  } catch (e) {
    throw e;
  }
}

async function fillWithdrawal(payer, users, tokensV3) {
  try {
    const usdcAddress = tokensV3['USDC'].address;
    const wethAddress = tokensV3['WETH'].address;
    const wbtcAddress = tokensV3['WBTC'].address;
    for (const user of users) {
      const signer = user.signer;
      const address = user.user;
      const balanceWeth = await payer.balanceOf(wethAddress, address);
      const balanceWbtc = await payer.balanceOf(wbtcAddress, address);
      const balanceUsdc = await payer.balanceOf(usdcAddress, address);
      if (cToken(balanceWeth, 'WETH') > 0) {
        tx = await payer.connect(signer).fullWithdrawalETH(balanceWeth);
        tx = await tx.wait();
        log(
          `✔ [contract][user] Вывод ${cToken(
            balanceWeth,
            'WETH'
          )} ETH от ${address}`,
          'green'
        );
      }
      if (cToken(balanceWbtc, 'WBTC') > 0) {
        tx = await payer
          .connect(signer)
          .fullWithdrawal(wbtcAddress, balanceWbtc);
        tx = await tx.wait();
        log(
          `✔ [contract][user] Вывод ${cToken(
            balanceWbtc,
            'WBTC'
          )} WBTC от ${address}`,
          'green'
        );
      }
      if (cToken(balanceUsdc, 'USDC') > 0) {
        tx = await payer
          .connect(signer)
          .fullWithdrawal(usdcAddress, balanceUsdc);
        tx = await tx.wait();
        log(
          `✔ [contract][user] Вывод ${cToken(
            balanceUsdc,
            'USDC'
          )} USDC от ${address}`,
          'green'
        );
      }
    }
  } catch (e) {
    throw e;
  }
}

module.exports = {
  getAdditionalAmount,
  getAmountToDeposit,
  postOrders,
  replaceUserAddresses,
  executeOrders,
  claimOrders,
  fillWithdrawal,
};
