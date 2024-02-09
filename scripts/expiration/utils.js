require('colors');
const { DECIMALS } = require('./contants');

function log(msg, color, newLine = false) {
  if (color) console.log(`${msg}`[color]);
  else console.log(msg);

  if (newLine)
    console.log('----------------------------------------------'.blue);
}
function sToken(amount, token) {
  const decimals = DECIMALS[token];
  let amountWei;

  if (token === 'WETH' || token === 'ETH') {
    amountWei = ethers.utils.parseEther(amount.toString()).toString();
  } else {
    const amountAsBigNumber = ethers.utils.parseUnits(
      amount.toString(),
      decimals
    );
    amountWei = amountAsBigNumber.toString();
  }

  return amountWei;
}

function cToken(amount, token) {
  const decimals = DECIMALS[token];
  let amountHuman;

  if (token === 'WETH' || token === 'ETH') {
    amountHuman = ethers.utils.formatEther(amount.toString()).toString();
  } else {
    const amountAsBigNumber = ethers.utils.formatUnits(
      amount.toString(),
      decimals
    );
    amountHuman = amountAsBigNumber.toString();
  }

  return amountHuman;
}

function thowDotPart(amount) {
  if (!String(amount).includes('.')) return 0;
  const [left, _] = String(amount).split('.');
  return left;
}

function convertFloatToBnString(float, decimals) {
  let result;
  let [left, right] = String(float).split('.');
  if (right && right.length > decimals) right = right.slice(0, decimals);
  result = left;
  if (right) {
    right = right.padEnd(decimals, '0');
    result = left.concat(right);
  } else {
    result = result + '0'.repeat(decimals);
  }
  return result.toString().replace(/^0+/, '');
}

function wait(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

module.exports = {
  log,
  sToken,
  cToken,
  thowDotPart,
  convertFloatToBnString,
  wait,
};
