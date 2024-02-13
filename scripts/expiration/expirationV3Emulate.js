const expirations = require('../../assets/expirations.json');
const { log } = require('./utils');
const {
  getAdditionalAmount,
  getAmountToDeposit,
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
  compareBalances,
  getSigners,
  checkBalances,
  checkServiceBalances,
  setAdditionalAmountToContract,
  checkContractBalances,
  checkEtherBalances,
  drainBalances,
  sendEthForTransfer,
} = require('./ethers');

async function main() {
  const [service, owner, users] = await getSigners();
  const ownerAddress = owner.address;
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
  for (const item of [expirations[42]]) {
    expirationId += 1;
    try {
      log(
        `Экспирация от ${new Date(item.expirationDate)} №${expirationId}`,
        'blue',
        true
      );
      let expiration = await replaceUserAddresses(item, users);
      const amountToDeposit = getAmountToDeposit(expiration);
      const additionalAmount = getAdditionalAmount(expiration);

      // await compareBalances(mint, tokensV3, ownerAddress);
      await setAdditionalAmountToContract(
        payer,
        additionalAmount,
        owner,
        tokensV3
      );
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

      // await checkEtherBalances(mint.users, tokensV3);
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
