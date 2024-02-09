const { log, sToken, cToken, convertFloatToBnString } = require('./utils');
const { DECIMALS } = require('./contants');

async function drainBalance(user, to) {
  // const balance = await user.getBalance();
  // const gasPrice = await ethers.provider.getGasPrice();
  // const gasLimit = ethers.BigNumber.from(21000);
  // const gasCost = gasPrice.mul(gasLimit);
  // const valueToSend = balance.sub(gasCost);
  // const tx = await user.sendTransaction({
  //   to,
  //   value: valueToSend,
  //   gasPrice: gasPrice,
  //   gasLimit: gasLimit,
  // });
  // tx.wait();
}

async function getSigners() {
  const accounts = await ethers.getSigners();
  const service = accounts[0];
  const owner = accounts[1];
  const users = [];
  for (let i = 2; i < accounts.length; i++) {
    users.push(accounts[i]);
  }
  for (const user of users) {
    await drainBalance(user, users[users.length - 1].address);
  }
  await drainBalance(owner, users[users.length - 1].address);
  return [service, owner, users];
}

async function deployTokens() {
  try {
    // Создаем токены
    log('Деплой токенов V3', 'blue', true);
    const Usdc = await hre.ethers.getContractFactory('ERC20');
    let usdc = await Usdc.deploy('USDC', 'USDC', DECIMALS.USDC);
    usdc = await usdc.deployed();
    const usdcAddress = usdc.address;
    log(`✔ ${usdcAddress}: usdc`, 'green');

    const Usdt = await hre.ethers.getContractFactory('ERC20');
    let usdt = await Usdt.deploy('USDT', 'USDT', DECIMALS.USDT);
    usdt = await usdt.deployed();
    const usdtAddress = usdt.address;
    log(`✔ ${usdtAddress}: usdt`, 'green');

    const Wbtc = await hre.ethers.getContractFactory('ERC20');
    let wbtc = await Wbtc.deploy('WBTC', 'WBTC', DECIMALS.WBTC);
    wbtc = await wbtc.deployed();
    const wbtcAddress = wbtc.address;
    log(`✔ ${wbtcAddress}: wbtc`, 'green');

    const WETH = await hre.ethers.getContractFactory('WETH9');
    let weth = await WETH.deploy();
    weth = await weth.deployed();
    const wethAddress = weth.address;
    log(`✔ ${wethAddress}: weth`, 'green', true);
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
  log(
    `✔ Баланс кошелька для перевода нативного ETH пополнен: ${balance} ETH (добавочный баланс для оплаты газа: ${balanceToPayFee} ETH)`,
    'green',
    true
  );
}

async function getEthTransferer() {
  try {
    const accounts = await hre.ethers.getSigners();
    const service = accounts[0];
    log(`✔ Кошелек для перевода нативного ETH: ${service.address}`, 'green');
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
    log(`✔ Общая сума для минта: ${totalAmount} ETH`, 'green');
    return totalAmount;
  } catch (e) {
    throw e;
  }
}

// Минтим всем пользователям токены в количестве депозита
async function mintTokensForUsers(mint, tokensV3) {
  try {
    const balanceToPayFee = 1;
    const transferer = await getEthTransferer();
    const ethToTransfer = await getTotalEthFromMint(mint['ETH']);
    await setAccountBalance(transferer.address, ethToTransfer, balanceToPayFee);
    log('Минт токенов для пользователей', 'blue', true);
    for (const [token, addresses] of Object.entries(mint)) {
      for (const [address, amount] of Object.entries(addresses)) {
        if (token === 'ETH') {
          const value = ethers.utils.parseUnits(amount.toString(), 'ether');
          const tx = await transferer.sendTransaction({
            to: address,
            value,
          });
          await tx.wait();
        } else {
          const tx = await tokensV3[token].mint(address, sToken(amount, token));
          await tx.wait();
        }
        log(`✔ Минт ${amount} ${token} для ${address}`, 'green');
      }
      log(`✔ Минт ${token} завершен`, 'green', true);
    }
  } catch (e) {
    throw e;
  }
}

// Минтим всем контракту токены в количестве минимальных обязательств
async function mintTokensForContract(mint, tokensV3, owner) {
  try {
    const balanceToPayFee = 1;
    const transferer = await getEthTransferer();
    const ethToTransfer = await getTotalEthFromMint(mint['ETH']);
    await setAccountBalance(transferer.address, ethToTransfer, balanceToPayFee);
    log('Минт токенов для контракта', 'blue', true);
    for (const [token, amount] of Object.entries(mint)) {
      if (token === 'ETH') {
        const value = ethers.utils.parseUnits(amount.toString(), 'ether');
        const tx = await transferer.sendTransaction({
          to: owner,
          value,
        });
        await tx.wait();
      } else {
        const tx = await tokensV3[token].mint(owner, sToken(amount, token));
        await tx.wait();
      }
      log(`✔ Минт ${amount} ${token} для ${owner}`, 'green');
      log(`✔ Минт ${token} завершен`, 'green', true);
    }
  } catch (e) {
    throw e;
  }
}

async function deploySwapRouter() {
  try {
    log('Деплой swap router', 'blue', true);
    const TestSwapRouter = await hre.ethers.getContractFactory(
      'TestSwapRouter'
    );
    let testSwapRouter = await TestSwapRouter.deploy();
    testSwapRouter = await testSwapRouter.deployed();
    log(`✔ ${testSwapRouter.address}: swap router`, 'green', true);
    return testSwapRouter;
  } catch (e) {
    throw e;
  }
}

async function deployPayer() {
  try {
    log('Деплой payerV3', 'blue', true);
    const Payer = await hre.ethers.getContractFactory('PayerV3');
    let payer = await Payer.deploy();
    payer = await payer.deployed();
    log(`✔ ${payer.address}: payerV3`, 'green', true);
    return payer;
  } catch (e) {
    throw e;
  }
}

async function compareUserBalances(mint, tokensV3) {
  try {
    log('Проверка баланса пользователей', 'blue', true);
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
          log(`✔ Баланс ${balance} ${token} у ${address}`, 'green');
        } else {
          log(`✖ Баланс нужен: ${amount} / На остатке: ${balance}`, 'red');
        }
      }
      log(`✔ Проверка баланса ${token} завершена`, 'green', true);
    }
  } catch (e) {
    throw e;
  }
}

async function checkBalances(addresses, tokensV3) {
  try {
    log('Проверка баланса пользователей', 'blue', true);
    for (const address of addresses) {
      const balanceEth = await ethers.provider.getBalance(address);
      const balanceWbtc = await tokensV3['WBTC'].balanceOf(address);
      const balanceUsdc = await tokensV3['USDC'].balanceOf(address);

      log(`✔ Баланс ${balanceEth} ETH у ${address}`, 'green');
      log(`✔ Баланс ${balanceWbtc} WBTC у ${address}`, 'green');
      log(`✔ Баланс ${balanceUsdc} USDC у ${address}`, 'green');
    }
  } catch (e) {
    throw e;
  }
}

async function compareContractBalances(mint, tokensV3, owner) {
  try {
    log('Проверка баланса контракта', 'blue', true);
    for (const [token, amount] of Object.entries(mint)) {
      let balance;
      if (token === 'ETH') {
        balance = await ethers.provider.getBalance(owner);
      } else {
        balance = await tokensV3[token].balanceOf(owner);
      }
      balance = cToken(balance, token);
      if (sToken(amount, token) === sToken(balance, token)) {
        log(`✔ Баланс ${balance} ${token} у ${owner}`, 'green');
      } else {
        log(`✖ Баланс нужен: ${amount} / На остатке: ${balance}`, 'red');
      }
      log(`✔ Проверка баланса ${token} завершена`, 'green', true);
    }
  } catch (e) {
    throw e;
  }
}

async function mintTokens(mint, additionalAmount, tokensV3, ownerAddress) {
  try {
    mint.contract = {
      ...mint.contract,
      USDC: parseFloat(
        cToken(
          convertFloatToBnString(
            mint.contract.USDC + additionalAmount,
            DECIMALS.USDC
          ),
          'USDC'
        )
      ),
    };
    await mintTokensForUsers(mint.users, tokensV3);
    await mintTokensForContract(mint.contract, tokensV3, ownerAddress);
  } catch (e) {
    throw e;
  }
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
};
