const deployments = require('../../deployments')
const BN = require('bn.js')
Helper = {
  filterTextKeys: (args) => {
    let decodedParams = {};
    for (const [key, value] of Object.entries(args)) {
      if (isNaN(Number(key))) {
        decodedParams[key] = value;
      }
    }
    return decodedParams
  },
  getNetworkName: (chainId) => {
    for (const [networkname, value] of Object.entries(deployments.networks)) {
      if (value.chainId == chainId) return networkname;
    }
    return null;
  },
  replaceAddresses: (arr) => {
    let existAddress = []
    for (const [networkname, data] of Object.entries(deployments.networks)) {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') existAddress.push({ address: value.toString().toLowerCase(), name: key });
      }
    }
    for (const [param, value] of Object.entries(arr)) {
      const foundAddress = existAddress.find((o) => o.address === value.toString().toLowerCase());
      if (foundAddress != undefined) {
        let decimals = 6
        if (foundAddress.name == 'WBTC') decimals = 8
        if (foundAddress.name == 'WETH') decimals = 18
        arr[`_${param}`] = { name: foundAddress.name, short: `${foundAddress.name} (${Helper.shortAddress(foundAddress.address)})`, address: foundAddress.address, decimals }
      }
    }
  },
  replaceAddress: (address) => {
    let existAddress = []
    for (const [networkname, data] of Object.entries(deployments.networks)) {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') existAddress.push({ address: value.toString().toLowerCase(), name: key });
      }
    }
    const foundAddress = existAddress.find((o) => o.address === address.toString().toLowerCase());
    if (foundAddress != undefined) {
      let decimals = 6
      if (foundAddress.name == 'WBTC') decimals = 8
      if (foundAddress.name == 'WETH') decimals = 18
      return { name: foundAddress.name, short: `${foundAddress.name} (${Helper.shortAddress(foundAddress.address)})`, address: foundAddress.address, decimals }
    } else {
      return { address }
    }
  },
  replaceBigNumber: (arr) => {
    for (let [index, value] of Object.entries(arr)) {
      if (typeof value === 'object' && value.constructor.name == 'BigNumber') {
        arr[index] = value.toString()
      }
    }
  },
  makeReadable: (arr) => {
    Helper.replaceAddresses(arr)
    Helper.replaceBigNumber(arr)
    return arr
  },
  IERC20: async (address) => {
    //! TODO нет метода forceApprove
    return await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', address);
  },
  IERC20Metadata: async (address) => {
    return await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata',
      address
    );
  },
  isAddress: (address) => {
    if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
      return false;
    } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
      return true;
    }
    return false;
  },
  shortAddress: (address) => {
    if (Helper.isAddress(address)) {
      return address.substr(0, 6) + '..' + address.substr(-4, 4);
    } else {
      return 'Wrong address'
    }
  },
  convertTokenAmount: (amount, decimal, nums = 4) => {
    const amountBn = new BN(amount.toString())
    const decimalBN = new BN(decimal.toString())
    const divisor = new BN(10).pow(decimalBN)

    const beforeDecimal = amountBn.div(divisor)
    const afterDecimal = amountBn.mod(divisor)

    const afterDecimalStr = afterDecimal.toString(10).padStart(decimal, '0')

    return `${beforeDecimal.toString()}.${afterDecimalStr.substr(0, nums)}`
  },
  readableTokenAmount: (token, amount, nums = 4) => {
    return Helper.convertTokenAmount(amount, token.decimals, nums)
  },
  ethPrice: 3300,
  btcPrice: 66000,
};

module.exports = Helper;
