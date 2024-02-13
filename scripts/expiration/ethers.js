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
  log(`✔ [contract] Деплой адресов`, 'green');
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
    log('✔ [contract] Деплой токенов V3', 'green');
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
}

async function deploySwapRouter() {
  try {
    const TestSwapRouter = await hre.ethers.getContractFactory(
      'TestSwapRouter'
    );
    let testSwapRouter = await TestSwapRouter.deploy();
    testSwapRouter = await testSwapRouter.deployed();
    log('✔ [contract] Деплой swap router', 'green');
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
    log('✔ [contract] Деплой payerV3', 'green');
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
      `✔ [contract][service] Баланс в контракте - сервиса WETH ${cToken(
        await payer.balanceOf(wethAddress, ownerAddress),
        'WETH'
      )}`,
      'green'
    );
    log(
      `✔ [contract][service] Баланс в контракте - сервиса WBTC ${cToken(
        await payer.balanceOf(wbtcAddress, ownerAddress),
        'WBTC'
      )}`,
      'green'
    );
    log(
      `✔ [contract][service] Баланс в контракте - сервиса USDC ${cToken(
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
  balanceUsdcNeed = cToken(
    convertFloatToBnString(balanceUsdcNeed, DECIMALS.USDC),
    'USDC'
  );
  if (
    balanceUsdc === balanceUsdcNeed ||
    parseFloat(balanceUsdc) - parseFloat(balanceUsdcNeed) < 0.001 //! TODO погрешность
  ) {
    log(
      `✔ [contract][user] Баланс нужен: ${balanceUsdcNeed} ${usdcSymbol} | На остатке: ${balanceUsdc} ${usdcSymbol} у ${address}`,
      'green'
    );
  } else {
    const message = `✖ [contract][user] Баланс нужен: ${balanceUsdcNeed} ${usdcSymbol} | На остатке: ${balanceUsdc} ${usdcSymbol} у ${address}`;
    log(message, 'red');
    throw new Error(message);
  }
}

async function checkEmptyBalance(payer, users, tokensV3) {
  for (const user of users) {
    const balanceUsdc = cToken(
      await payer.balanceOf(tokensV3['USDC'].address, user.user),
      ['USDC']
    );
    const balanceWeth = cToken(
      await payer.balanceOf(tokensV3['WETH'].address, user.user),
      ['WETH']
    );
    const balanceWbtc = cToken(
      await payer.balanceOf(tokensV3['WBTC'].address, user.user),
      ['WBTC']
    );
    if (
      parseFloat(balanceUsdc) > 0 ||
      parseFloat(balanceWeth) > 0 ||
      parseFloat(balanceWbtc) > 0
    ) {
      log(
        `✖ [contract][user] Баланс после вывода USDC: ${balanceUsdc} | WBTC: ${balanceWbtc} | WETH: ${balanceWeth}`,
        'ret'
      );
      throw new Error(
        `✖ [contract][user] Баланс после вывода USDC: ${balanceUsdc} | WBTC: ${balanceWbtc} | WETH: ${balanceWeth}`
      );
    } else {
      log(
        `✔ [contract][user] Баланс после вывода USDC: ${balanceUsdc} | WBTC: ${balanceWbtc} | WETH: ${balanceWeth}`,
        'green'
      );
    }
  }
}

async function checkContractBalances(payer, orders, tokensV3) {
  try {
    const balanceNeed = {};
    for (const order of orders) {
      const tokenOutSymbol = tokensV1[order.tokenOut];
      const usdcSymbol = 'USDC';
      const address = order.user;
      if (tokenOutSymbol === usdcSymbol) {
        const additionalAmount = parseFloat(order.additionalAmount);
        const amountOut = parseFloat(order.amountOut);
        const balanceUsdcNeed = amountOut + additionalAmount;
        if (balanceNeed[address]) {
          if (balanceNeed[address]['USDC'])
            balanceNeed[address]['USDC'] =
              balanceNeed[address]['USDC'] + balanceUsdcNeed;
          else balanceNeed[address]['USDC'] = balanceUsdcNeed;
        } else balanceNeed[address] = { USDC: balanceUsdcNeed };
      } else {
        const additionalAmount = parseFloat(order.additionalAmount);
        const balanceUsdcNeed = additionalAmount;
        if (balanceNeed[address]) {
          if (balanceNeed[address]['USDC'])
            balanceNeed[address]['USDC'] =
              balanceNeed[address]['USDC'] + balanceUsdcNeed;
          else balanceNeed[address]['USDC'] = balanceUsdcNeed;
        } else balanceNeed[address] = { USDC: balanceUsdcNeed };

        if (balanceNeed[address][tokenOutSymbol])
          balanceNeed[address][tokenOutSymbol] =
            balanceNeed[address][tokenOutSymbol] + order.amountOut;
        else balanceNeed[address][tokenOutSymbol] = order.amountOut;
      }
    }

    for (const [address, tokens] of Object.entries(balanceNeed)) {
      for (const [tokenSymbol, value] of Object.entries(tokens)) {
        const tokenAddress = tokensV3[tokenSymbol].address;

        if (tokenSymbol === 'USDC')
          await compareBalanceUsdc(
            payer,
            value,
            tokenAddress,
            tokenSymbol,
            address
          );
        else {
          const balance = cToken(
            await payer.balanceOf(tokenAddress, address),
            tokenSymbol
          );
          const valueNeed = cToken(
            convertFloatToBnString(value, DECIMALS[tokenSymbol]),
            tokenSymbol
          );
          if (
            balance === valueNeed ||
            parseFloat(balance) - parseFloat(valueNeed) < 0.0000001 //! TODO погрешность
          ) {
            log(
              `✔ [contract][user] Баланс нужен: ${valueNeed} ${tokenSymbol} | На остатке: ${balance} ${tokenSymbol} у ${address}`,
              'green'
            );
          } else {
            const message = `✖ [contract][user] Баланс нужен: ${valueNeed} ${tokenSymbol} | На остатке: ${balance} ${tokenSymbol} у ${address}`;
            log(message, 'red');
            throw new Error(message);
          }
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
      log(`✔ [contract]: Баланс ${balanceWeth} WETH у ${address}`, 'green');
      log(`✔ [contract]: Баланс ${balanceWbtc} WBTC у ${address}`, 'green');
      log(`✔ [contract]: Баланс ${balanceUsdc} USDC у ${address}`, 'green');
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
  await owner.sendTransaction({ to: wethAddress, value: sToken(5000, 'ETH') });
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
  checkEmptyBalance,
};
