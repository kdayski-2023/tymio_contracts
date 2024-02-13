const expirations = require('../../assets/expirations.json');
const { log, cToken } = require('./utils');
const {
  getAdditionalAmount,
  postOrders,
  replaceUserAddresses,
  executeOrders,
  claimOrders,
  fillWithdrawal,
} = require('./expiration');
const {
  setRatio,
  setAcceptableTokens,
  setSwapRouter,
  setWeth,
  setPayerAddress,
} = require('./contract');
const {
  deployTokens,
  deploySwapRouter,
  deployPayer,
  mintTokens,
  getSigners,
  checkServiceBalances,
  setAdditionalAmountToContract,
  checkContractBalances,
  sendEthForTransfer,
  checkEmptyBalance,
} = require('./ethers');

async function main() {
  const [service, owner, users] = await getSigners();
  const tokens = await deployTokens();
  const swapRouter = await deploySwapRouter();
  const payer = await deployPayer();

  // Адаптация старых токенов под только что созданные
  const tokensV3 = {
    USDC: tokens.usdc,
    WETH: tokens.weth,
    WBTC: tokens.wbtc,
    ETH: tokens.weth,
  };

  await setAcceptableTokens(payer, tokensV3);
  await setWeth(payer, tokensV3);
  await setSwapRouter(payer, swapRouter);
  await setPayerAddress(payer, owner.address);
  await sendEthForTransfer(owner, tokens.weth.address);
  await mintTokens(tokensV3);

  let errors = 0;
  let expirationId = 0;
  for (const item of [expirations[expirations.length - 1]]) {
    expirationId += 1;
    try {
      log(
        `✔ [expiration][info] Экспирация от ${new Date(
          item.expirationDate
        )} №${expirationId}`,
        'blue'
      );
      let expiration = await replaceUserAddresses(item, users);
      const additionalAmount = getAdditionalAmount(expiration);

      await setAdditionalAmountToContract(
        payer,
        additionalAmount,
        owner,
        tokensV3
      );
      await checkServiceBalances(payer, owner.address, tokensV3);
      await setRatio(swapRouter, tokensV3, expiration.prices);

      expiration = await postOrders(payer, expiration, tokensV3);
      await executeOrders(payer, expiration, tokensV3);
      await claimOrders(payer, expiration, tokensV3);

      const expirationUsers = expiration.orders.map(
        ({ user, signer, tokenOut }) => ({
          user,
          signer,
          tokenOut,
        })
      );
      await checkContractBalances(payer, expiration.orders, tokensV3);
      await fillWithdrawal(payer, expirationUsers, tokensV3);
      await checkEmptyBalance(payer, expirationUsers, tokensV3);

      const balanceUsdc = cToken(
        await payer.getTokenBalance(tokensV3['USDC'].address),
        ['USDC']
      );
      const balanceEth = cToken(await payer.getEthBalance());
      const balanceWeth = cToken(
        await payer.getTokenBalance(tokensV3['WETH'].address),
        ['WETH']
      );
      const balanceWbtc = cToken(
        await payer.getTokenBalance(tokensV3['WBTC'].address),
        ['WBTC']
      );
      log(
        `✔ [contract][service] Баланс после вывода USDC: ${balanceUsdc} | WBTC: ${balanceWbtc} | WETH: ${balanceWeth} | ETH: ${balanceEth}`,
        'blue'
      );
      // if (
      //   parseFloat(balanceUsdc) > 0 ||
      //   parseFloat(balanceWeth) > 0 ||
      //   parseFloat(balanceWbtc) > 0 ||
      //   parseFloat(balanceEth) > 0
      // ) {
      //   log(
      //     `✖ [contract][service] Баланс после вывода USDC: ${balanceUsdc} | WBTC: ${balanceWbtc} | WETH: ${balanceWeth} | ETH: ${balanceEth}`,
      //     'red'
      //   );
      //   throw new Error(
      //     `✖ [contract][service] Баланс после вывода USDC: ${balanceUsdc} | WBTC: ${balanceWbtc} | WETH: ${balanceWeth} | ETH: ${balanceEth}`
      //   );
      // } else {
      //   log(
      //     `✔ [contract][service] Баланс после вывода USDC: ${balanceUsdc} | WBTC: ${balanceWbtc} | WETH: ${balanceWeth} | ETH: ${balanceEth}`,
      //     'green'
      //   );
      // }
    } catch (e) {
      log(e);
      errors += 1;
      break;
    }
  }
  console.log({ errors, expirationId });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
