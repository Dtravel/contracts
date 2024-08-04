import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

import './hardhat.tasks';

dotenv.config();

const accounts = process.env.ADMIN_PRIVATE_KEY !== undefined ? [process.env.ADMIN_PRIVATE_KEY] : [];
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.26',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
            },
          },
        },
      },
    ],
  },
  networks: {
    testnet: {
      url: process.env.BASE_TESTNET_RPC || '',
      chainId: 84532,
      accounts,
    },
    mainnet: {
      url: process.env.BASE_MAINNET_RPC || '',
      chainId: 8453,
      accounts,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
  },
  etherscan: {
    apiKey: process.env.SCAN_API_KEY,
    customChains: [
      {
        network: 'Base Sepolia Testnet',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network: 'Base Mainnet',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
};

export default config;
