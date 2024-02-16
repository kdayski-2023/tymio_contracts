const BN = web3.utils.BN;
const expirationsOriginal = require('../assets/expirations.json');
const { cToken, sToken, wait } = require('./utils');
const {
  getAdditionalAmount,
  postOrders,
  replaceUserAddresses,
  executeOrders,
  claimOrders,
  fullWithdrawal,
  getArgsForExecuteOrders,
} = require('./expiration');
const {
  setRatio,
  setAcceptableTokens,
  setSwapRouter,
  setWeth,
  setPayerAddress,
  getSwapsOutMinimal,
} = require('./contract');
const {
  deployTokens,
  deploySwapRouter,
  deployPayer,
  mintTokens,
  getSigners,
  setAdditionalAmountToContract,
  checkContractBalances,
  sendEthForTransfer,
  checkEmptyBalances,
} = require('./ethers');
const { tokensV1 } = require('./contants');

let owner, users, tokens, swapRouter, payer, tokensV3, expiration, signers;
let expirations = expirationsOriginal;

beforeEach(async () => {});
describe('Expiration', async () => {
  it('Deploy contracts', async () => {
    tokens = await deployTokens();
    swapRouter = await deploySwapRouter();
    payer = await deployPayer();
  });
  it('Prepare contract for expiration', async () => {
    expiration = expirations[expirations.length - 1];
    tokensV3 = {
      USDC: tokens.usdc,
      WETH: tokens.weth,
      WBTC: tokens.wbtc,
      ETH: tokens.weth,
    };
    tokensV3[tokens.usdc.address] = 'USDC';
    tokensV3[tokens.weth.address] = 'WETH';
    tokensV3[tokens.wbtc.address] = 'WBTC';
    await setRatio(swapRouter, tokensV3, expiration.prices);
  });
  it('Prepare accounts', async () => {
    signers = await getSigners();
    owner = signers[1];
    users = signers.slice(2)[0];
    await sendEthForTransfer(owner, tokens.weth.address);
    await mintTokens(signers, tokensV3);
  });
  it('Set acceptable tokens', async () => {
    await setAcceptableTokens(payer, tokensV3);
    expect(await payer.acceptableTokensArray(0)).to.equal(
      tokensV3['USDC'].address
    );
    expect(await payer.acceptableTokensArray(1)).to.equal(
      tokensV3['WETH'].address
    );
    expect(await payer.acceptableTokensArray(2)).to.equal(
      tokensV3['WBTC'].address
    );
  });
  it('Set weth', async () => {
    await setWeth(payer, tokensV3);
    expect(await payer.wethAddress()).to.equal(tokensV3['WETH'].address);
  });
  it('Set swapRouter', async () => {
    await setSwapRouter(payer, swapRouter);
    expect(await payer.swapRouter()).to.equal(swapRouter.address);
  });
  it('Set payer address', async () => {
    await setPayerAddress(payer, owner.address);
    expect(await payer.payerAddress()).to.equal(owner.address);
  });
  it('Replace user addresses', async () => {
    expiration = await replaceUserAddresses(expiration, users);
  });
  it('Set additional amount to contract', async () => {
    const additionalAmount = getAdditionalAmount(expiration);
    await setAdditionalAmountToContract(
      payer,
      additionalAmount,
      owner,
      tokensV3
    );
    const balance = await payer.balanceOf(
      tokensV3['USDC'].address,
      owner.address
    );
    expect(cToken(balance, 'USDC')).to.equal(additionalAmount);
  });
  it('Post orders', async () => {
    const orderDuration = 1;
    expiration = await postOrders(payer, expiration, orderDuration, tokensV3);
    const now = new BN(Math.floor(new Date().getTime() / 1000));

    for (const order of expiration.orders) {
      const contractOrder = await payer.orders(order.contract_id);
      expect(contractOrder.user).to.equal(order.user);
      expect(contractOrder.tokenIn).to.equal(
        tokensV3[tokensV1[order.tokenIn]].address
      );
      expect(contractOrder.amountIn).to.equal(
        sToken(order.amountIn, tokensV1[order.tokenIn])
      );
      expect(contractOrder.tokenOut).to.equal(
        tokensV3[order.targetTokenSymbolOut].address
      );
      expect(contractOrder.amountOut).to.equal(sToken(0));
      expect(contractOrder.price).to.equal(sToken(order.price, 'USD'));
      expect(contractOrder.additionalAmount).to.equal(sToken(0));
      expect(contractOrder.endTimestamp).to.be.above(now);
      expect(contractOrder.completed).to.be.false;
      expect(contractOrder.claimed).to.be.false;
    }
  });
  it('Execute orders', async () => {
    const expirationDuration = 5;
    const args = await getArgsForExecuteOrders(expiration);
    expect(args[0].length).to.equal(expiration.orders.length);
    expect(args[1].length).to.equal(expiration.orders.length);
    expect(args[2].length).to.equal(expiration.orders.length);
    const swapOutMinimal = await getSwapsOutMinimal(
      payer,
      args,
      expiration.prices,
      tokensV3
    );
    console.log(Math.floor(new Date().getTime() / 1000));
    await wait(expirationDuration);
    await executeOrders(payer, args, swapOutMinimal);
    const now = new BN(Math.floor(new Date().getTime() / 1000));
    console.log(Math.floor(new Date().getTime() / 1000));
    for (const order of expiration.orders) {
      const contractOrder = await payer.orders(order.contract_id);
      expect(contractOrder.user).to.equal(order.user);
      expect(contractOrder.tokenIn).to.equal(
        tokensV3[tokensV1[order.tokenIn]].address
      );
      expect(contractOrder.amountIn).to.equal(
        sToken(order.amountIn, tokensV1[order.tokenIn])
      );
      expect(contractOrder.tokenOut).to.equal(
        tokensV3[tokensV1[order.tokenOut]].address
      );
      expect(contractOrder.amountOut).to.equal(
        sToken(order.amountOut, tokensV1[order.tokenOut])
      );
      expect(contractOrder.price).to.equal(sToken(order.price, 'USD'));
      expect(contractOrder.additionalAmount).to.equal(
        sToken(order.additionalAmount, 'USD')
      );
      console.log(contractOrder.endTimestamp);
      console.log(order.endTimestamp);
      expect(contractOrder.endTimestamp).to.be.below(now);
      expect(contractOrder.completed).to.be.true;
      expect(contractOrder.claimed).to.be.false;
    }
  });
  // it('Claim orders', async () => {
  //   await claimOrders(payer, expiration, tokensV3);
  // });
  // it('Check contract balances', async () => {
  //   await checkContractBalances(payer, expiration, tokensV3);
  // });
  // it('Full withdrawal', async () => {
  //   await fullWithdrawal(payer, expiration, tokensV3);
  // });
  // it('Check empty balances', async () => {
  //   await checkEmptyBalances(payer, expiration, tokensV3);
  // });
  // const balanceUsdc = cToken(
  //   await payer.getTokenBalance(tokensV3['USDC'].address),
  //   ['USDC']
  // );

  // const balanceEth = cToken(await payer.getEthBalance());
  // const balanceWeth = cToken(
  //   await payer.getTokenBalance(tokensV3['WETH'].address),
  //   ['WETH']
  // );
  // const balanceWbtc = cToken(
  //   await payer.getTokenBalance(tokensV3['WBTC'].address),
  //   ['WBTC']
  // );
  // log(
  //   `✔ [contract][service] Баланс после вывода USDC: ${balanceUsdc} | WBTC: ${balanceWbtc} | WETH: ${balanceWeth} | ETH: ${balanceEth}`,
  //   'blue'
  // );
});
Helper = {
  gasUsed: (tx) => {
    return `Gas Used: ${tx.gasUsed}`;
  },
};
