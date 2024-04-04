// BigNumber библиотека (предполагаем использование bignumber.js)
const BigNumber = require('bn.js')
// USDC сумма и цена BTC в BigNumber формате с decimal = 6
const usdcAmount = new BigNumber('6300000000') // 6300 * 10^6
const btcPrice = new BigNumber('70000000000') // 70000 * 10^6

// Расчет количества BTC
const btcAmount = usdcAmount.mul(new BigNumber(10 ** 2)).div(btcPrice);

// Вывод результата
console.log(btcAmount.toString()); // Выведет количество BTC с учетом decimal