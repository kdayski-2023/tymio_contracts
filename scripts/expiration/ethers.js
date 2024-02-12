const { log, sToken, cToken, convertFloatToBnString } = require('./utils');
const { DECIMALS, tokensV1 } = require('./contants');

async function drainBalances(users, to) {
  // for (const user of users) {
  //   const balance = await user.getBalance();
  //   const gasPrice = await ethers.provider.getGasPrice();
  //   const gasLimit = ethers.BigNumber.from(21000);
  //   const gasCost = gasPrice.mul(gasLimit);
  //   const valueToSend = balance.sub(gasCost);
  //   const tx = await user.sendTransaction({
  //     to,
  //     value: valueToSend,
  //     gasPrice: gasPrice,
  //     gasLimit: gasLimit,
  //   });
  //   tx.wait();
  // }
}

async function getSigners() {
  const accounts = await ethers.getSigners();
  const service = accounts[0];
  const owner = accounts[1];
  const users = [];
  for (let i = 2; i < accounts.length; i++) {
    users.push(accounts[i]);
  }
  log(`✔ [contract] Деплой адресов`, 'yellow');
  return [service, owner, users];
}

async function deployTokens() {
  try {
    const Usdc = await hre.ethers.getContractFactory('ERC20');
    let usdc = await Usdc.deploy('USDC', 'USDC', DECIMALS.USDC);
    usdc = await usdc.deployed();

    const Usdt = await hre.ethers.getContractFactory('ERC20');
    let usdt = await Usdt.deploy('USDT', 'USDT', DECIMALS.USDT);
    usdt = await usdt.deployed();

    const Wbtc = await hre.ethers.getContractFactory('ERC20');
    let wbtc = await Wbtc.deploy('WBTC', 'WBTC', DECIMALS.WBTC);
    wbtc = await wbtc.deployed();

    const WETH = await hre.ethers.getContractFactory('WETH9');
    let weth = await WETH.deploy();
    weth = await weth.deployed();
    log('✔ [contract] Деплой токенов V3', 'yellow');
    return { usdc, usdt, weth, wbtc };
  } catch (e) {
    throw e;
  }
}

async function setAccountBalance(address, amount, balanceToPayFee) {
  const balance = amount + balanceToPayFee;
  const balanceHex = ethers.utils.hexValue(
    ethers.utils.parseUnits(balance.toString(), 'ether')
  );
  await network.provider.send('hardhat_setBalance', [address, balanceHex]);
}

async function getEthTransferer() {
  try {
    const accounts = await hre.ethers.getSigners();
    const service = accounts[0];
    return service;
  } catch (e) {
    throw e;
  }
}

async function getTotalEthFromMint(mint) {
  try {
    let totalAmount = 0;
    if (typeof mint !== 'object') {
      if (mint) return mint;
      else return 0;
    }
    for (const [_, amount] of Object.entries(mint)) {
      totalAmount += amount;
    }
    return totalAmount;
  } catch (e) {
    throw e;
  }
}

async function setAdditionalAmountToContract(
  payer,
  additionalAmount,
  owner,
  tokensV3
) {
  const usdc = tokensV3['USDC'];
  const usdcAddress = usdc.address;
  tx = await usdc
    .connect(owner)
    .approve(payer.address, sToken(additionalAmount, 'USDC'));
  tx = await tx.wait();
  tx = await payer
    .connect(owner)
    .deposit(usdcAddress, sToken(additionalAmount, 'USDC'));
  tx = await tx.wait();
  log('✔ [ethers] Отправка additional amount суммы на контракт', 'magenta');
  log(
    `✔ [contract]: Баланс в контракте - сервиса USDC ${cToken(
      await payer.balanceOf(usdcAddress, owner.address),
      'USDC'
    )}`,
    'yellow'
  );
}

async function deploySwapRouter() {
  try {
    const TestSwapRouter = await hre.ethers.getContractFactory(
      'TestSwapRouter'
    );
    let testSwapRouter = await TestSwapRouter.deploy();
    testSwapRouter = await testSwapRouter.deployed();
    log('✔ [contract] Деплой swap router', 'yellow');
    return testSwapRouter;
  } catch (e) {
    throw e;
  }
}

async function deployPayer() {
  try {
    const Payer = await hre.ethers.getContractFactory('PayerV3');
    let payer = await Payer.deploy();
    payer = await payer.deployed();
    log('✔ [contract] Деплой payerV3', 'yellow');
    return payer;
  } catch (e) {
    throw e;
  }
}

async function compareUserBalances(mint, tokensV3) {
  try {
    for (const [token, addresses] of Object.entries(mint)) {
      for (const [address, amount] of Object.entries(addresses)) {
        let balance;
        if (token === 'ETH') {
          balance = await ethers.provider.getBalance(address);
        } else {
          balance = await tokensV3[token].balanceOf(address);
        }
        balance = cToken(balance, token);

        if (sToken(amount, token) === sToken(balance, token)) {
          log(
            `✔ [ethers][user] Баланс нужен: ${amount} ${token} / На остатке: ${balance} ${token} у ${address}`,
            'magenta'
          );
        } else {
          const message = `✖ [ethers][user] Баланс нужен: ${amount} ${token} / На остатке: ${balance} ${token} у ${address}`;
          log(message, 'red');
          throw new Error(message);
        }
      }
    }
  } catch (e) {
    throw e;
  }
}

async function checkServiceBalances(payer, ownerAddress, tokensV3) {
  try {
    const usdcAddress = tokensV3['USDC'].address;
    const wethAddress = tokensV3['WETH'].address;
    const wbtcAddress = tokensV3['WBTC'].address;
    log(
      `✔ [contract]: Баланс в контракте - сервиса WETH ${cToken(
        await payer.balanceOf(wethAddress, ownerAddress),
        'WETH'
      )}`,
      'green'
    );
    log(
      `✔ [contract]: Баланс в контракте - сервиса WBTC ${cToken(
        await payer.balanceOf(wbtcAddress, ownerAddress),
        'WBTC'
      )}`,
      'green'
    );
    log(
      `✔ [contract]: Баланс в контракте - сервиса USDC ${cToken(
        await payer.balanceOf(usdcAddress, ownerAddress),
        'USDC'
      )}`,
      'green'
    );
  } catch (e) {
    throw e;
  }
}

async function compareBalanceUsdc(
  payer,
  balanceUsdcNeed,
  usdcAddress,
  usdcSymbol,
  address
) {
  const balanceUsdc = cToken(
    await payer.balanceOf(usdcAddress, address),
    usdcSymbol
  );
  if (parseFloat(balanceUsdc) === parseFloat(balanceUsdcNeed)) {
    log(
      `✔ [contract][user] Баланс нужен: ${balanceUsdcNeed} ${usdcSymbol} / На остатке: ${balanceUsdc} ${usdcSymbol} у ${address}`,
      'yellow'
    );
  } else {
    const message = `✖ [contract][user] Баланс нужен: ${balanceUsdcNeed} ${usdcSymbol} / На остатке: ${balanceUsdc} ${usdcSymbol} у ${address}`;
    log(message, 'red');
    throw new Error(message);
  }
}

async function checkContractBalances(payer, orders, tokensV3) {
  try {
    for (const order of orders) {
      const tokenOutSymbol = tokensV1[order.tokenOut];
      const tokenOutAddress = tokensV3[tokenOutSymbol].address;
      const usdcSymbol = 'USDC';
      const usdcAddress = tokensV3[usdcSymbol].address;
      const address = order.user;
      const balance = cToken(
        await payer.balanceOf(tokenOutAddress, address),
        tokenOutSymbol
      );
      if (tokenOutSymbol === usdcSymbol) {
        const additionalAmount = parseFloat(order.additionalAmount);
        const amountOut = parseFloat(order.amountOut);
        const balanceUsdcNeed = parseFloat(
          cToken(
            convertFloatToBnString(amountOut + additionalAmount, DECIMALS.USDC),
            'USDC'
          )
        );
        await compareBalanceUsdc(
          payer,
          balanceUsdcNeed,
          usdcAddress,
          usdcSymbol,
          address
        );
      } else {
        const additionalAmount = parseFloat(order.additionalAmount);
        const balanceUsdcNeed = additionalAmount;
        await compareBalanceUsdc(
          payer,
          balanceUsdcNeed,
          usdcAddress,
          usdcSymbol,
          address
        );
        if (parseFloat(balance) === parseFloat(order.amountOut)) {
          log(
            `✔ [contract][user] Баланс нужен: ${order.amountOut} ${tokenOutSymbol} / На остатке: ${balance} ${tokenOutSymbol} у ${address}`,
            'yellow'
          );
        } else {
          const message = `✖ [contract][user] Баланс нужен: ${order.amountOut} ${tokenOutSymbol} / На остатке: ${balance} ${tokenOutSymbol} у ${address}`;
          log(message, 'red');
          throw new Error(message);
        }
      }
    }
  } catch (e) {
    throw e;
  }
}

async function checkEtherBalances(mint, tokensV3) {
  try {
    for (const [token, addresses] of Object.entries(mint)) {
      for (const [address, amount] of Object.entries(addresses)) {
        let balance;
        if (token === 'ETH') {
          balance = await ethers.provider.getBalance(address);
        } else {
          balance = await tokensV3[token].balanceOf(address);
        }
        balance = cToken(balance, token);

        if (sToken(amount, token) === sToken(balance, token)) {
          log(
            `✔ [ethers][user] Баланс нужен: ${amount} ${token} / На остатке: ${balance} ${token} у ${address}`,
            'magenta'
          );
        } else {
          const message = `✖ [ethers][user] Баланс нужен: ${amount} ${token} / На остатке: ${balance} ${token} у ${address}`;
          log(message, 'red');
          throw new Error(message);
        }
      }
    }
  } catch (e) {
    throw e;
  }
}

async function checkBalances(payer, users, ownerAddress, tokensV3) {
  try {
    log('Проверка баланса пользователей', 'blue', true);
    const usdcAddress = tokensV3['USDC'].address;
    const wethAddress = tokensV3['WETH'].address;
    const wbtcAddress = tokensV3['WBTC'].address;
    for (const user of users) {
      const address = user.user;
      const balanceWeth = cToken(
        await payer.balanceOf(wethAddress, address),
        'ETH'
      );
      const balanceWbtc = cToken(
        await payer.balanceOf(wbtcAddress, address),
        'WBTC'
      );
      const balanceUsdc = cToken(
        await payer.balanceOf(usdcAddress, address),
        'USDC'
      );
      log(`✔ [contract]: Баланс ${balanceWeth} WETH у ${address}`, 'yellow');
      log(`✔ [contract]: Баланс ${balanceWbtc} WBTC у ${address}`, 'yellow');
      log(`✔ [contract]: Баланс ${balanceUsdc} USDC у ${address}`, 'yellow');
    }
    await checkServiceBalances(payer, ownerAddress, tokensV3);
  } catch (e) {
    throw e;
  }
}

async function compareContractBalances(mint, tokensV3, owner) {
  try {
    for (const [token, amount] of Object.entries(mint)) {
      let balance;
      if (token === 'ETH') {
        balance = await ethers.provider.getBalance(owner);
      } else {
        balance = await tokensV3[token].balanceOf(owner);
        balance = convertFloatToBnString(
          cToken(balance, token),
          DECIMALS[token]
        );
      }
      if (!balance) balance = '0';
      console.log({ balance, token });
      balance = cToken(balance, token);
      if (sToken(amount, token) === sToken(balance, token)) {
        log(
          `✔ [ethers][service] Баланс нужен: ${amount} ${token} / На остатке: ${balance} ${token}`,
          'magenta'
        );
      } else {
        const message = `✖ [ethers][service] Баланс нужен: ${amount} ${token} / На остатке: ${balance} ${token}`;
        log(message, 'red');
        throw new Error(message);
      }
    }
  } catch (e) {
    throw e;
  }
}

async function mintTokens(tokensV3) {
  try {
    const accounts = await ethers.getSigners();
    for (const account of accounts) {
      tx = await tokensV3['USDC'].mint(
        account.address,
        sToken(1000000, 'USDC')
      );
      await tx.wait();
      tx = await tokensV3['WBTC'].mint(account.address, sToken(100, 'WBTC'));
      await tx.wait();
    }
    log('✔ [ethers] Минт токенов', 'magenta');
  } catch (e) {
    throw e;
  }
}

async function sendEthForTransfer(owner, wethAddress) {
  await owner.sendTransaction({ to: wethAddress, value: sToken(100, 'ETH') });
}

async function compareBalances(mint, tokensV3, ownerAddress) {
  try {
    await compareUserBalances(mint.users, tokensV3);
    await compareContractBalances(mint.contract, tokensV3, ownerAddress);
  } catch (e) {
    throw e;
  }
}

module.exports = {
  deployTokens,
  deploySwapRouter,
  deployPayer,
  compareBalances,
  mintTokens,
  getSigners,
  checkBalances,
  checkServiceBalances,
  setAdditionalAmountToContract,
  checkContractBalances,
  checkEtherBalances,
  drainBalances,
  sendEthForTransfer,
};
