const expirations = require('../../assets/expirations.json');
const { log } = require('./utils');
const {
  getAdditionalAmount,
  getMint,
  postOrders,
  replaceUserAddresses,
  executeOrders,
  claimOrders,
} = require('./expiration');
const {
  setRatio,
  setAcceptableTokens,
  setSwapRouter,
  setWeth,
} = require('./contract');
const {
  deployTokens,
  deploySwapRouter,
  deployPayer,
  mintTokens,
  compareBalances,
  getSigners,
  checkBalances,
} = require('./ethers');

async function main() {
  log('', false, true);

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

  for (const item of [expirations[expirations.length - 1]]) {
    try {
      log(`Экспирация от ${new Date(item.expirationDate)}`, 'blue', true);
      let expiration = await replaceUserAddresses(item, users);
      const mint = getMint(expiration);
      const additionalAmount = getAdditionalAmount(expiration);
      await mintTokens(mint, additionalAmount, tokensV3, ownerAddress);
      await compareBalances(mint, tokensV3, ownerAddress);
      await setRatio(swapRouter, tokensV3, expiration.prices);

      expiration = await postOrders(payer, expiration, tokensV3);
      await executeOrders(payer, expiration, tokensV3);
      await claimOrders(payer, expiration, tokensV3);

      const expirationUsers = expiration.map(({ user }) => user);
      await checkBalances(expirationUsers);
    } catch (e) {
      log(e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
