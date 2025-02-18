const { filterTextKeys, getNetworkName, makeReadable, readableTokenAmount, replaceAddress } = require('../helpers/web3');
const deployments = require('../../deployments');
const hre = require('hardhat');
const { ethers } = require('hardhat');

const checkedOrders = []
const alreadyClaimedAndComplited = {
    42161: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53],
    8453: []
}

async function main() {
    const checkAll = true;
    const chainId = hre.network.config.network_id;
    const networkName = getNetworkName(chainId)
    console.log(`Анализ балансов в PriceProtectionV1`)
    console.log(`Сеть: ${networkName}`)

    const priceProtectionV1 = await ethers.getContractAt('PriceProtectionV1', deployments.networks[networkName].priceProtectionV1);
    const payerAddress = await priceProtectionV1.payerAddress()

    // Получаем список поддерживаемых токенов
    const acceptableTokensArrayLength = Number(await priceProtectionV1.acceptableTokensArrayLength());
    const tokenStats = {};
    const userBalances = {};

    // Собираем информацию по каждому токену
    for (let i = 0; i < acceptableTokensArrayLength; i++) {
        const tokenAddress = await priceProtectionV1.acceptableTokensArray(i);
        const token = await ethers.getContractAt('IERC20Metadata', tokenAddress);
        const tokenSymbol = await token.symbol();

        const totalBalance = Number(await token.balanceOf(priceProtectionV1.address));
        const payerBalance = Number(await priceProtectionV1.balanceOf(tokenAddress, payerAddress));

        tokenStats[tokenAddress] = {
            symbol: tokenSymbol,
            totalBalance,
            payerBalance,
            lockedInOrders: 0,
            additionalAmountTotal: 0
        };
    }

    // Анализируем ордера
    let orderId = 0;
    while (true) {
        try {
            // Пропускаем уже обработанные ордера только если checkAll = false
            if (!checkAll && alreadyClaimedAndComplited[chainId]?.includes(orderId)) {
                orderId++;
                continue;
            }
            console.log(orderId)

            const order = makeReadable(filterTextKeys(await priceProtectionV1.orders(orderId)));
            if (order.claimed && order.completed) {
                checkedOrders.push(orderId)
            }
            const userAddress = order.user;
            if (!userBalances[userAddress]) {
                userBalances[userAddress] = {};
                for (const [addr, token] of Object.entries(tokenStats)) {
                    userBalances[userAddress][addr] = await priceProtectionV1.balanceOf(addr, userAddress);
                }
            }
            if (!order.claimed) {
                tokenStats[order.token].lockedInOrders += Number(order.amount);
            }
            if (!order.claimed && order.completed) {
                tokenStats[order.token].additionalAmountTotal += Number(order.additionalAmount);
            }
            orderId++;
        } catch (error) {
            console.log(error)
            break;
        }
    }
    console.log('Fill AlreadyClaimedAndComplited')
    console.log(checkedOrders)

    // Выводим статистику
    console.log('\nСтатистика по токенам:');
    let totalUsdBalance = 0;

    for (const [tokenAddress, stats] of Object.entries(tokenStats)) {
        const token = replaceAddress(tokenAddress);
        console.log(`\n${stats.symbol}:`);
        console.log(`Общий баланс контракта: ${readableTokenAmount(token, stats.totalBalance)}`);
        console.log(`Баланс payerAddress: ${readableTokenAmount(token, stats.payerBalance)}`);
        console.log(`Обязательства по выплатам: ${readableTokenAmount(token, stats.additionalAmountTotal)}`);
        console.log(`Заблокировано в ордерах: ${readableTokenAmount(token, stats.lockedInOrders)}`);
        console.log(`Свободно: ${readableTokenAmount(token, stats.totalBalance - stats.lockedInOrders)}`);

        totalUsdBalance += Number(stats.totalBalance);
    }

    console.log(`\nОбщий баланс в USD: $${totalUsdBalance / 1e6}`);

    // Добавляем отслеживание невостребованных выплат для каждого пользователя
    const userPendingClaims = {};
    for (const [userAddress] of Object.entries(userBalances)) {
        userPendingClaims[userAddress] = {};
        for (const [addr] of Object.entries(tokenStats)) {
            userPendingClaims[userAddress][addr] = 0;
        }
    }

    // Пересчитываем ордера для подсчета невостребованных выплат
    orderId = 0;
    while (true) {
        try {
            const order = makeReadable(filterTextKeys(await priceProtectionV1.orders(orderId)));
            if (!order.claimed && order.completed) {
                const userAddress = order.user;
                userPendingClaims[userAddress][order.token] += Number(order.additionalAmount);
            }
            orderId++;
        } catch (error) {
            break;
        }
    }

    // Модифицируем вывод балансов пользователей
    console.log('\nБалансы пользователей:');
    for (const [userAddress, balances] of Object.entries(userBalances)) {
        let totalUserBalance = 0;
        let totalPendingClaims = 0;
        const tokenBalances = [];
        const pendingClaimsInfo = [];

        for (const [tokenAddr, balance] of Object.entries(balances)) {
            const pendingAmount = userPendingClaims[userAddress][tokenAddr];
            if (Number(balance) > 0 || pendingAmount > 0) {
                const symbol = tokenStats[tokenAddr].symbol;
                const amount = Number(balance) / 1e6;
                const pendingUsd = pendingAmount / 1e6;
                
                if (amount > 0) {
                    tokenBalances.push(`${symbol}: ${amount}`);
                    totalUserBalance += amount;
                }
                if (pendingUsd > 0) {
                    pendingClaimsInfo.push(`${symbol}: ${pendingUsd}`);
                    totalPendingClaims += pendingUsd;
                }
            }
        }

        if (totalUserBalance > 0 || totalPendingClaims > 0) {
            const shortAddress = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
            console.log(
                `${shortAddress}: $${totalUserBalance.toFixed(2)} ` +
                `(${tokenBalances.join(', ')})` +
                (totalPendingClaims > 0 ? ` К получению: $${totalPendingClaims.toFixed(2)} (${pendingClaimsInfo.join(', ')})` : '')
            );
        }
    }
}

// Запускаем скрипт
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
