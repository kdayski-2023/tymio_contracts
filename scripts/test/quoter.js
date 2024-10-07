const { ethers } = require('ethers');
const { abi: QuoterABI } = require('@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json');

async function getQuote(tokenIn, tokenOut, amountIn) {
    // Адрес контракта Quoter на сети Base
    const QUOTER_ADDRESS = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';

    // Подключение к провайдеру Base (используем публичный RPC)
    const provider = new ethers.providers.JsonRpcProvider('https://base-mainnet.infura.io/v3/9300fcead7b044fe9a88ec01533a6255');

    // Создание экземпляра контракта Quoter
    const quoterContract = new ethers.Contract(QUOTER_ADDRESS, QuoterABI, provider);

    try {
        // Вызов функции quoteExactInputSingle
        const quote = await quoterContract.callStatic.quoteExactInputSingle([
            tokenIn,
            tokenOut,
            amountIn,
            '500', // fee (0.05% для пары USDC-WETH)
            '0' // sqrtPriceLimitX96
        ]
    );
    
    // console.log('quote', quote)
        console.log(`За ${ethers.utils.formatUnits(amountIn, 6)} USDC`);
        console.log(`Вы получите ${ethers.utils.formatEther(quote.amountOut)} WETH`);

        return quote;
    } catch (error) {
        console.error('Ошибка при получении котировки:', error);
    }
}

// Адреса токенов на Base
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const WETH = '0x4200000000000000000000000000000000000006';

// Сумма USDC для обмена (например, 1000 USDC)
const amountIn = ethers.utils.parseUnits('1000', 6); // USDC имеет 6 десятичных знаков

getQuote(USDC, WETH, amountIn);
