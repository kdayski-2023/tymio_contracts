const { filterTextKeys, getNetworkName, makeReadable, convertTokenAmount, readableTokenAmount, replaceAddress } = require('../helpers/web3');
var fs = require('fs');
const axios = require('axios');
const deployments = require('../../deployments');
const apiUrl = 'https://api.tymio.com/api';

let priceProtectionV1,
    block,
    acceptableTokensArrayLength,
    networkName,
    payerAddress,
    payerAddress1;
const acceptableTokensArray = [];
const additionalAmounts = [];
const usdTokens = [];



async function main() {
    const blockNumber = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNumber);

    const chainId = hre.network.config.network_id;
    networkName = getNetworkName(chainId);
    console.log(`Сеть: ${networkName}`);
    console.log(`PriceProtectionV1 адрес: ${deployments.networks[networkName].priceProtectionV1}`);
    priceProtectionV1 = await ethers.getContractAt('PriceProtectionV1', deployments.networks[networkName].priceProtectionV1);
    payerAddress1 = await priceProtectionV1.payerAddress();

    const contractParams = JSON.parse(fs.readFileSync('./temp/data.json', 'utf8'));
    const _params = {
        orderIds: contractParams._params[0],
        exec: contractParams._params[1],
        additionalAmount: contractParams._params[2],
    };

    const orderIds = contractParams._params[0];
    const contractOrders = {};
    const orderTimestamps = [];
    const sum = contractParams._params[2].reduce((partialSum, a) => Number(partialSum) + Number(a), 0);
    console.log(`Ордера (${orderIds.length}): ${orderIds}`);

    const orderPromises = orderIds.map(async (orderId, i) => {
        const order = makeReadable(filterTextKeys(await priceProtectionV1.orders(orderId)));
        contractOrders[orderId] = order;
        orderTimestamps.push(order.executionTimestamp);

        // Подробное время
        console.log(`[${orderId}] ${getReadebleTimestamp(order.executionTimestamp)}`);

        const needExec = contractParams._params[1][i];
        let amountTxt = '';
        if (needExec) {
            amountTxt = `EXECUTE ${readableTokenAmount(order._token, order.amount)} (${order.amount}) ${order._token.short}`;
        } else {
            amountTxt = `==> ${readableTokenAmount(order._token, order.amount)} (${order.amount}) ${order._token.short}`;
        }
        const additionalAmount = convertTokenAmount(contractParams._params[2][i], 6);
        console.log(`[${orderId}] ${amountTxt} + ${additionalAmount} usd`);
    });

    await Promise.all(orderPromises);

    // CALC TIME LAG
    console.log(`Минимальное время ордера ${getReadebleTimestamp(arrayMin(orderTimestamps))}. Максимальное ${getReadebleTimestamp(arrayMax(orderTimestamps))}`);
    console.log(`Ордера [C]`);
    //#region PREPARING
    acceptableTokensArrayLength = Number(await priceProtectionV1.acceptableTokensArrayLength());

    for (let i = 0; i < acceptableTokensArrayLength; i++) {
        const acceptableTokenAddress = await priceProtectionV1.acceptableTokensArray(i);
        acceptableTokensArray.push(acceptableTokenAddress);
        usdTokens.push(acceptableTokenAddress.toLowerCase());
        additionalAmounts.push({ token: acceptableTokenAddress.toLowerCase(), additionalAmount: 0, payerBalance: await priceProtectionV1.balanceOf(acceptableTokenAddress, payerAddress1) });
    }

    // check Payer address balances
    for (let i = 0; i < orderIds.length; i++) {
        const orderId = contractParams._params[0][i];
        const additionalAmount = contractParams._params[2][i];
        const order = contractOrders[orderId];
        let payToken = order.token;
        if (isUsdTokenCheck(order.token)) {
            payToken = order.token;
        }
        if (payToken == '0x0') {
            console.log(order);
        }
        const finded = additionalAmounts.find((o) => o.token == payToken.toLowerCase());
        finded.additionalAmount += Number(additionalAmount);
    }
    console.log(`Нужно выплатить всего: ${sum} USD`);
    
    console.log(`Выплаты пользователям:`);
    for (const additionalAmountToken of additionalAmounts) {
        const additionalToken = replaceAddress(additionalAmountToken.token);
        console.log(`${additionalToken.short} ${readableTokenAmount(additionalToken, additionalAmountToken.additionalAmount)} Доступно ${readableTokenAmount(additionalToken, additionalAmountToken.payerBalance)}`);
    }

    console.log("Начало эмуляции выполнения");
    await emulateExecution(_params);
    console.log("Эмуляция завершена");
}
async function emulateExecution(_params) {
    console.log(`Эмуляция вызова функции executeOrders [C]`);

    const orderIdsLength = _params.orderIds.length;

    if (!(orderIdsLength == _params.exec.length && orderIdsLength == _params.additionalAmount.length)) {
        console.error('Ошибка: DifferentLength()');
        return;
    }

    for (let i = 0; i < orderIdsLength; i++) {
        const orderId = _params.orderIds[i];
        const order = makeReadable(filterTextKeys(await priceProtectionV1.orders(orderId)));

        if (!(block.timestamp >= order.executionTimestamp)) {
            console.error(`Ошибка: WrongExecutionTime(${orderId})`);
            return;
        }
        if (order.claimed) {
            console.error(`Ошибка: OrderAlreadyClaimed(${orderId})`);
            return;
        }
        if (order.completed) {
            console.error(`Ошибка: OrderAlreadyCompleted(${orderId})`);
            return;
        }

        console.log(`Эмуляция выполнения ордера ${orderId}`);
        console.log(`  Токен: ${order.token}`);
        console.log(`  Сумма: ${order.amount}`);
        console.log(`  Дополнительная сумма: ${_params.additionalAmount[i]}`);
        console.log(`  Выполнить: ${_params.exec[i]}`);

        if (_params.exec[i]) {
            const payerBalance = await priceProtectionV1.balanceOf(order.token, payerAddress);
            if (payerBalance.lt(_params.additionalAmount[i])) {
                console.error(`Ошибка: InsufficientPayerBalance для ордера ${orderId}`);
                return;
            }
        }
    }

    console.log("Эмуляция выполнена успешно");
}
async function apiGetUserOrders(userAddress) {
    return new Promise((resolve) => {
        axios
            .get(
                `${apiUrl}/user_orders?userAddress=${userAddress}`
            )
            .then(function (response) {
                resolve(response.data.data);
            })
            .catch(function (error) {
                console.log(error);
            });
    });
}

function arrayMin(arr) {
    return arr.reduce(function (p, v) {
        return (p < v ? p : v);
    });
}

function arrayMax(arr) {
    return arr.reduce(function (p, v) {
        return (p > v ? p : v);
    });
}

function isUsdTokenCheck(token) {
    return usdTokens.includes(token.toLowerCase());
}

function getReadebleTimestamp(timestamp) {
    const pad = (n, s = 2) => (`${new Array(s).fill(0)}${n}`).slice(-s);
    const d = new Date(timestamp * 1000);
    const hours = pad(d.getHours() + 2);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${pad(d.getFullYear(), 4)} ${hours}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
