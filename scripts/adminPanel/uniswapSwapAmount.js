const { filterTextKeys, getNetworkName, makeReadable, convertTokenAmount, readableTokenAmount, IERC20, IERC20Metadata, replaceAddress } = require('../helpers/web3');

const deployments = require('../../deployments')
async function main() {
    const blockNumber = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNumber);

    const chainId = hre.network.config.network_id;
    console.log(chainId)
    networkName = getNetworkName(chainId)
    console.log(`Сеть: ${networkName}`)

    const uniswapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

    // Адрес токена, который вы хотите получить
    const tokenAddress = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
    const WETH9Address = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
    // Address of the Uniswap V3 router contract on mainnet

    // Address of the token you want to receive

    // Amount of ETH you want to swap (1 ETH in this case)
    const ethAmount = ethers.utils.parseEther("1");

    // Get the Uniswap router contract instance
    const router = await ethers.getContractAt("@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol:ISwapRouter", uniswapRouterAddress);

    // Define the pool fee tier (e.g., 3000 for 0.3%)
    const poolFee = 3000;

    // Create params for exactInputSingle swap
    const params = {
        tokenIn: WETH9Address,
        tokenOut: tokenAddress,
        fee: poolFee,
        recipient: "0xE36490e9aEe2cCc6870F31706E358481b8ec5D6d", // Address to receive tokens
        deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from now
        amountIn: ethAmount,
        amountOutMinimum: 0, // You might want to set a minimum output amount
        sqrtPriceLimitX96: 0, // This can be used for price protection
    };

    // Estimate the amount of tokens you would receive
    const amountsOut = await router.callStatic.exactInputSingle(params);

    console.log(`For 1 ETH, you would receive approximately ${ethers.utils.formatUnits(amountsOut, 18)} tokens.`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });