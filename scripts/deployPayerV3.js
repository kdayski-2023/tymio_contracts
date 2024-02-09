const BN = require('bn.js');

const log = (...args) => {
  console.log(...args);
};
function sEth(amount) {
  return convertStr(amount, 18);
}
function sUsd(amount) {
  return convertStr(amount, 6);
}
function sBtc(amount) {
  return convertStr(amount, 8);
}
function convertStr(amount, decimal) {
  const amountBn = new BN(amount.toString());
  const decimalBN = new BN(decimal.toString());
  const divisor = new BN(10).pow(decimalBN);
  return amountBn.mul(divisor).toString();
}

async function main() {
  const ownerAddress = '0x05528440b9e0323D7CCb9Baf88b411CE481694a0';
  const mintAmount = 1000000;
  const usdWbtcPrice = 2300; // цена 1 usd к btc
  const wbtcUsdPrice = 43063540000; // цена 1 btc к usd
  const ethUsdPrice = 2363590000; // цена 1 eth к usd
  const usdEthPrice = 4200000000000000; // цена 1 usd к eth
  log(`${ownerAddress}: owner`);

  // const Usdc = await hre.ethers.getContractFactory('ERC20')
  // let usdc = await Usdc.deploy("USDC", "USDC", 6)
  // usdc = await usdc.deployed()
  // const usdcAddress = usdc.address
  // tx = await usdc.mint(ownerAddress, sUsd(mintAmount))
  // await tx.wait()
  const usdcAddress = '0xDdE3f67f0A697B0f4633F4869F3E21135eb89156';
  log(`${usdcAddress}: usdc`);

  // const Usdt = await hre.ethers.getContractFactory('ERC20')
  // let usdt = await Usdt.deploy("USDT", "USDT", 6)
  // usdt = await usdt.deployed()
  // const usdtAddress = usdt.address
  // tx = await usdt.mint(ownerAddress, sUsd(mintAmount) )
  // await tx.wait()
  const usdtAddress = '0x759f126610C109641827bac698480B53A48DdD84';
  log(`${usdtAddress}: usdt`);

  // const Wbtc = await hre.ethers.getContractFactory('ERC20')
  // let wbtc = await Wbtc.deploy("WBTC", "WBTC", 8)
  // wbtc = await wbtc.deployed()
  // const wbtcAddress = wbtc.address
  // tx = await wbtc.mint(ownerAddress, sBtc(mintAmount) )
  // await tx.wait()
  const wbtcAddress = '0x624444B413199506E4879a5DC48249d4E0a2bC70';
  log(`${wbtcAddress}: wbtc`);

  // const WETH = await hre.ethers.getContractFactory('WETH9')
  // let weth = await WETH.deploy()
  // weth = await weth.deployed()
  // const wethAddress = weth.address
  // tx = await weth.mint(ownerAddress, sEth(mintAmount) )
  // await tx.wait()
  const wethAddress = '0x2fCd10712dDd4DEDA1F24197A56c05458721Ed68';
  log(`${wethAddress}: weth`);

  const TestSwapRouter = await hre.ethers.getContractFactory('TestSwapRouter');
  let testSwapRouter = await TestSwapRouter.deploy();
  testSwapRouter = await testSwapRouter.deployed();
  const testSwapRouterAddress = testSwapRouter.address;
  tx = await testSwapRouter.setRatio(usdcAddress, wethAddress, usdEthPrice);
  await tx.wait();
  tx = await testSwapRouter.setRatio(usdtAddress, wethAddress, usdEthPrice);
  await tx.wait();
  tx = await testSwapRouter.setRatio(wethAddress, usdtAddress, ethUsdPrice);
  await tx.wait();
  tx = await testSwapRouter.setRatio(wethAddress, usdcAddress, ethUsdPrice);
  await tx.wait();
  tx = await testSwapRouter.setRatio(wbtcAddress, usdtAddress, wbtcUsdPrice);
  await tx.wait();
  tx = await testSwapRouter.setRatio(wbtcAddress, usdcAddress, wbtcUsdPrice);
  await tx.wait();
  tx = await testSwapRouter.setRatio(usdtAddress, wbtcAddress, usdWbtcPrice);
  await tx.wait();
  tx = await testSwapRouter.setRatio(usdcAddress, wbtcAddress, usdWbtcPrice);
  await tx.wait();
  // const testSwapRouterAddress = '0xf8A69E98191147df93405a8AE828Eab7BaAe0F8F'
  log(`${testSwapRouterAddress}: testSwapRouter`);

  const Payer = await hre.ethers.getContractFactory('PayerV3');
  let payer = await Payer.deploy();
  payer = await payer.deployed();
  const payerAddress = payer.address;
  log(`${payerAddress}: PayerV3`);

  tx = await payer.editAcceptableToken(usdcAddress, true, true);
  await tx.wait();
  tx = await payer.editAcceptableToken(usdtAddress, true, true);
  await tx.wait();
  tx = await payer.editAcceptableToken(wethAddress, true, false);
  await tx.wait();
  tx = await payer.editAcceptableToken(wbtcAddress, true, false);
  await tx.wait();
  tx = await payer.setWeth(wethAddress);
  await tx.wait();
  tx = await payer.setSwapRouter(testSwapRouterAddress);
  await tx.wait();
  log('All contract settings are set');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
