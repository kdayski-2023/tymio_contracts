const deployments = require('../../deployments');
Helper = {
  filterTextKeys: (args) => {
    let decodedParams = {};
    for (const [key, value] of Object.entries(args)) {
      if (isNaN(Number(key))) {
        decodedParams[key] = value;
      }
    }
    return decodedParams;
  },
  getNetworkName: (chainId) => {
    for (const [networkname, value] of Object.entries(deployments.networks)) {
      if (value.chainId == chainId) return networkname;
    }
    return null;
  },
  replaceAddresses: (arr) => {
    let existAddress = [];
    for (const [networkname, data] of Object.entries(deployments.networks)) {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') existAddress.push({ address: value.toString().toLowerCase(), name: key });
      }
    }
    for (const [param, value] of Object.entries(arr)) {
      const foundAddress = existAddress.find((o) => o.address === value.toString().toLowerCase());
      if (foundAddress != undefined) {
        arr[param] = `${foundAddress.name} (${Helper.shortAddress(foundAddress.address)})`;
      }
    }
    return arr;
  },
  IERC20: async (address) => {
    //! TODO нет метода forceApprove
    return await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', address);
  },
  IERC20Metadata: async (address) => {
    //! TODO нет метода forceApprove
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
      return 'Wrong address';
    }
  },
};

module.exports = Helper;
