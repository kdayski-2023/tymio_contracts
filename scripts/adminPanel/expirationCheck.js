const { filterTextKeys, getNetworkName, replaceAddresses, IERC20 } = require('../helpers/web3');
const contractParamsAll = {
  1: { _params: [[], [], []], _amountOutMinimum: [], _claimOrders: false, _usdClaimToken: '' },
  42161: { _params: [[], [], []], _amountOutMinimum: [], _claimOrders: false, _usdClaimToken: '' },
  80001: { _params: [[], [], []], _amountOutMinimum: [], _claimOrders: false, _usdClaimToken: '' },
  421614: {
    _params: [[55], [true], ['67528591']],
    _amountOutMinimum: ['6052007863'],
    _claimOrders: false,
    _usdClaimToken: '0x1DDC824D3af1f7d6c13eE9307817111A75D04520',
  },
};
const deployments = require('../../deployments');

const bn = ethers.BigNumber.from;
let payerV3, block, acceptableTokensArrayLength, networkName, ISwapRouter, poolFee, swapDeadline;
let swapsIn = {};
let swapsOut = {};
const acceptableTokensArray = [];

async function main() {
  const blockNumber = await ethers.provider.getBlockNumber();
  block = await ethers.provider.getBlock(blockNumber);

  const chainId = hre.network.config.network_id;
  networkName = getNetworkName(chainId);
  console.log(deployments.networks[networkName].payerV3);
  payerV3 = await ethers.getContractAt('PayerV3', deployments.networks[networkName].payerV3);
  ISwapRouter = await ethers.getContractAt('TestSwapRouter', deployments.networks[networkName].swapRouter);
  poolFee = await payerV3.poolFee();
  //! TODO swapDeadline должен быть публичным
  //   swapDeadline = await payerV3.swapDeadline();
  swapDeadline = bn(10 * 60 * 1000);
  console.log(`Network ${networkName}`);
  const contractParams = contractParamsAll[chainId];
  console.log(`Contract params:`);
  console.log(contractParams);
  const orderIds = contractParams._params[0];
  for (const orderId of orderIds) {
    const order = await payerV3.orders(orderId);
    console.log(replaceAddresses(filterTextKeys(order)));
  }
  console.log(`Execution order IDs: ${orderIds}`);

  acceptableTokensArrayLength = Number(await payerV3.acceptableTokensArrayLength());
  //#region PREPARING

  for (let i = 0; i < acceptableTokensArrayLength; i++) {
    acceptableTokensArray.push(await payerV3.acceptableTokensArray(i));
  }

  swapsIn = {};
  swapsOut = {};
  for (let i = 0; i < acceptableTokensArray.length; i++) {
    for (let j = 0; j < acceptableTokensArray.length; j++) {
      if (acceptableTokensArray[i] === acceptableTokensArray[j]) continue;
      if (!swapsIn[acceptableTokensArray[i]]) swapsIn[acceptableTokensArray[i]] = {};
      if (!swapsOut[acceptableTokensArray[i]]) swapsOut[acceptableTokensArray[i]] = {};
      swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] = bn(0);
      swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = bn(0);
    }
  }
  const _params = {
    orderIds: contractParams._params[0],
    swap: contractParams._params[1],
    additionalAmount: contractParams._params[2],
  };
  //#endregion
  await emulateExecution(
    _params,
    contractParams._amountOutMinimum,
    contractParams._claimOrders,
    contractParams._usdClaimToken
  );
}

async function emulateExecution(_params, _amountOutMinimum, _claimOrders, _usdClaimToken) {
  console.log(`EMULATE executeOrders`);

  const orderIdsLength = _params.orderIds.length;

  if (!(orderIdsLength == _params.swap.length && _params.swap.length == _params.additionalAmount.length)) {
    revert('DifferentLength()');
  }

  for (let i = 0; i < orderIdsLength; i++) {
    const order = await payerV3.orders(_params.orderIds[i]);

    if (!(block.timestamp >= order.endTimestamp)) {
      revert('WrongExpirationTime()');
    }
    if (order.claimed) {
      revert('OrderAlreadyClaimed()');
    }
    if (order.completed) {
      revert('OrderAlreadyCompleted()');
    }
    if (_params.swap[i]) {
      swapsIn[order.tokenIn][order.tokenOut] = swapsIn[order.tokenIn][order.tokenOut].add(
        bn(order.amountIn.toString())
      );
    }
  }
  console.log(swapsIn);

  let swapsCount = 0;
  for (let i = 0; i < acceptableTokensArrayLength; i++) {
    for (let j = 0; j < acceptableTokensArrayLength; j++) {
      if (swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] > 0) {
        //! TODO по контракту должен исполняться не approve, а forceApprove
        await (
          await (
            await IERC20(acceptableTokensArray[i])
          ).approve(
            deployments.networks[networkName].swapRouter,
            swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]]
          )
        ).wait();

        const swapParams = {
          tokenIn: acceptableTokensArray[i],
          tokenOut: acceptableTokensArray[j],
          fee: poolFee,
          //! TODO нормального человека сюда подставить
          //   recipient: hre.network.config.accounts[0],
          recipient: '0x05528440b9e0323D7CCb9Baf88b411CE481694a0',
          deadline: block.timestamp + swapDeadline,
          amountIn: swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]],
          amountOutMinimum: _amountOutMinimum[swapsCount],
          sqrtPriceLimitX96: 0,
        };
        console.log(swapParams);

        const amountOut = bn((await (await ISwapRouter.exactInputSingle(swapParams)).wait()).events[2].data);
        console.log(amountOut);
        console.log(_amountOutMinimum[swapsCount]);
        console.log(amountOut.gt(bn(_amountOutMinimum[swapsCount])));

        if (!amountOut.gt(bn(_amountOutMinimum[swapsCount]))) {
          revert('IncorrectAmountOut()');
        }
        swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = amountOut;
        swapsCount++;
      }
    }
  }
  for (let i = 0; i < orderIdsLength; i++) {
    _executeOrder(_params.orderIds[i], _params.swap[i], _params.additionalAmount[i]);
  }
  if (_claimOrders) {
    for (let i = 0; i < orderIdsLength; i++) {
      claimOrder(_params.orderIds[i], _usdClaimToken, false);
    }
  }
  for (let i = 0; i < acceptableTokensArrayLength; i++) {
    for (let j = 0; j < acceptableTokensArrayLength; j++) {
      swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] = 0;
    }
  }
}

function _executeOrder(orderId, swap, additionalAmount) {
  // TODO
  console.log({ orderId, swap, additionalAmount });
}

function claimOrder(_orderId, _usdToken, _force) {
  // TODO
  console.log({ _orderId, _usdToken, _force });
}

function revert(msg) {
  console.log(`Reverted ${msg}`);
  // process.exit()
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
