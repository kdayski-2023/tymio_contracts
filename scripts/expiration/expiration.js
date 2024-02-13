const {
  log,
  cToken,
  convertFloatToBnString,
  sToken,
  wait,
} = require('./utils');
const { tokensV1, DECIMALS } = require('./contants');
const { checkContractBalances } = require('./ethers');

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
    log('✔ [expiration] Обязательства на выплату контрактом комиссии', 'green');
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
      'green'
    );
    log(
      `✔ [expiration] Минимальные обязательства на выплату контрактом сформированы`,
      'green'
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
        const _tokenAddressIn = tokensV3['WETH'].address;
        const _tokenAddressOut = tokensV3['USDC'].address;
        const _amount = sToken(amountIn, 'WETH');
        const _price = sToken(price, 'USDC');
        const _duration = orderDuration;
        const value = sToken(amountIn, 'ETH');

        tx = await payer
          .connect(signer)
          .depositEthAndOrder(
            _tokenAddressIn,
            _tokenAddressOut,
            _amount,
            _price,
            _duration,
            { value }
          );
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
        `✔ [contract] Запись сделки ${order.contract_id} на ${direction} ${amountIn} ${tokenInSymbol} за ${price}`,
        'yellow'
      );
    }
    log(`✔ [contract] Запись сделок`, 'yellow');
    log(`Ждем ${expirationDuration} сек`, 'blue');
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
      const { tokenIn, amountIn } = await payer.orders(order.contract_id);
    }
    for (const order of expiration.orders) {
      args[0].push(order.contract_id);
      args[1].push(order.order_executed);
      args[2].push(sToken(order.additionalAmount, 'USDC'));
      if (order.order_executed) {
        swapAmount[order.targetTokenSymbolOut] =
        swapAmount[order.targetTokenSymbolOut] + order.amountOut;
      }
    }
    console.log(swapAmount)
    //args = [[args[0][7]], [args[1][7]], [args[2][7]]];
    tx = await payer.executeOrders(args, []);
    tx = await tx.wait();
    log('✔ [contract] Сделки исполнены', 'yellow');
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
    }
    log(`✔ [contract] Клейм сделок`, 'yellow');
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
          `✔ [contract]: Вывод ${cToken(
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
          `✔ [contract]: Вывод ${cToken(
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
          `✔ [contract]: Вывод ${cToken(
            balanceUsdc,
            'USDC'
          )} USDC от ${address}`,
          'green'
        );
      }
    }
    log('✔ [contract] Средства выведены', 'yellow');
  } catch (e) {
    throw e;
  }
}

// log(`[contract]: Баланс в контракте - сервиса USDC ${cUsd(await payer.balanceOf(usdcAddress, ownerAddress))} `)
// log(`[contract]: Баланс в контракте - сервиса USDT ${cUsd(await payer.balanceOf(usdtAddress, ownerAddress))} `)
// log(`[contract]: Баланс в контракте - сервиса WETH ${cEth(await payer.balanceOf(wethAddress, ownerAddress))} `)
// log(`[contract]: Баланс в контракте - пользователя USDC ${cUsd(await payer.balanceOf(usdcAddress, userAddress))} `)
// log(`[contract]: Баланс в контракте - пользователя USDT ${cUsd(await payer.balanceOf(usdtAddress, userAddress))} `)
// log(`[contract]: Баланс в контракте - пользователя WETH ${cEth(await payer.balanceOf(wethAddress, userAddress))} `)
// console.log(cEth(await ethers.provider.getBalance(userAddress)))

module.exports = {
  getAdditionalAmount,
  getAmountToDeposit,
  postOrders,
  replaceUserAddresses,
  executeOrders,
  claimOrders,
  fillWithdrawal,
};
