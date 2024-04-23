require('solidity-coverage');
require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-chai-matchers');
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');
require('dotenv').config({ path: __dirname + '/.env' });
require('hardhat-change-network');

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: { optimizer: { enabled: true, runs: 50000 } },
      },
    ],
  },
  namedAccounts: {
    deployer: 0,
    oracleWeezi: 1,
    user: 2,
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      allowUnlimitedContractSize: true,
      accounts: { count: 100 },
    },
    mainet: {
      network_id: 1,
      url: 'https://mainnet.infura.io/v3/facd693a8e764005bf265d603b34a4f9',
      accounts: [DEPLOYER_PRIVATE_KEY],
      gas: 8e6,
      gasPrice: 5000000000,
    },
    arbitrum: {
      network_id: 42161,
      // url: 'https://arbitrum-mainnet.infura.io/v3/dbfff08523c14a52b0280dc383126193',
      url: 'https://arb1.arbitrum.io/rpc',
      accounts: [DEPLOYER_PRIVATE_KEY],
      gas: 8e6,
      gasPrice: 100000000,
    },
    sepolia: {
      network_id: 11155111,
      url: 'https://sepolia.gateway.tenderly.co',
      accounts: [DEPLOYER_PRIVATE_KEY],
      gas: 8e6,
      gasPrice: 1000000000,
    },
    arbsepolia: {
      network_id: 421614,
      url: 'https://arbitrum-sepolia.blockpi.network/v1/rpc/public ',
      accounts: [DEPLOYER_PRIVATE_KEY],
      gas: 8e6,
      gasPrice: 1000000000,
    },
    celotest: {
      network_id: 44787,
      url: 'https://alfajores-forno.celo-testnet.org',
      accounts: [DEPLOYER_PRIVATE_KEY],
      gas: 8e6,
      gasPrice: 10000000000,
    },
    rpc: {
      network_id: 14,
      url: 'http://localhost:8545',
      gas: 8e6,
      gasPrice: 5000000000,
    },
    twat: {
      network_id: 666777,
      url: 'http://83.220.168.72:15456',
      accounts: [DEPLOYER_PRIVATE_KEY],
      gas: 30e6,
      gasPrice: 5000000000,
    },
    polygon: {
      url: 'https://rpc.ankr.com/polygon',
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 140000000000,
      gas: 15e6,
    },
    mumbai: {
      network_id: 80001,
      url: 'https://polygon-mumbai.infura.io/v3/010ca5412a6e47f28f00bb896bf11922',
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 9000000000,
      gas: 15e6,
    },
    goerli: {
      url: 'https://rpc.ankr.com/eth_goerli',
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 900000000,
      gas: 4000000,
      gasMultiplier: 5,
    },
  },
  ipfs: {
    url: 'https://ipfs.infura.io:5001/',
    pinata: {
      key: process.env.PINATA_KEY || 'c3ce0a276d9339578da7',
      secret:
        process.env.PINATA_SECRET_KEY ||
        '46b24e90fdc1c494027269aceb75f43ab60108961d1962c13d2cd412e355c4c0',
    },
  },
  mocha: {
    timeout: 30000,
  },
  etherscan: {
    apiKey: {
      mainnet: 'BAFQGJ4M5B94JHBB1HESS4BQGIUJNKXXMB',
      goerli: 'BAFQGJ4M5B94JHBB1HESS4BQGIUJNKXXMB',
      polygon: '82C8JFDCT4PH1791FHGVYK3INN2S5RJ1YC',
      polygonMumbai: '82C8JFDCT4PH1791FHGVYK3INN2S5RJ1YC',
      bsc: 'GSYYDG6Z48HQ4ZC6K7XNBU9UTZI21GV38Y',
      bscTestnet: 'GSYYDG6Z48HQ4ZC6K7XNBU9UTZI21GV38Y',
      arbsepolia: 'PZAWVZRJXA5AX3MIN9NPC4VATACGXK7YPN'
    },
    customChains: [
      {
        network: "arbsepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      }
    ]
  }
};
