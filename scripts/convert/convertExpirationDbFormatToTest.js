const fs = require('fs');
const importFile = '../../assets/expirationDbFormat.json'
const file = require(importFile)
let orders = file.orders
let newOrders = convertOrderFormat(orders)
console.log(newOrders)
const networkConfig = {
    WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
}
function convertOrderFormat(orders) {
    return orders.map(order => {
        const parsedOrder = order
        const direction = parsedOrder.direction;
        const amountIn = direction === "sell" ? parsedOrder.contracts : 0;
        const amountOut = direction === "buy" ? parsedOrder.contracts : 0;
        const tokenSymbolOut = order.instrument_name.split("-")[0];
        const instrumentSuffix = order.instrument_name.slice(-1);

        const tokenIn = instrumentSuffix === "C" && direction === "sell"
            ? "0x0000000000000000000000000000000000000000"
            : instrumentSuffix === "P" && direction === "buy"
                ? networkConfig.USDC
                : networkConfig.WETH; // Default or other cases
        if (
            tokenIn == networkConfig.WETH
        ) {

        }
        return {
            user: order.from,
            tokenIn,
            amountIn,
            tokenOut: "0x0000000000000000000000000000000000000000",
            amountOut,
            price: order.price,
            additionalAmount: order.recieve.toString(),
            endTimestamp: order.execute_date,
            targetTokenSymbolOut: tokenSymbolOut,
            direction,
            order_executed: order.order_complete
        };
    });
}