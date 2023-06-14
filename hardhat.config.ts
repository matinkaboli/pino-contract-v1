import dotenv from 'dotenv';
import '@nomicfoundation/hardhat-toolbox';
import { HardhatUserConfig } from 'hardhat/config';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.18',
        settings: {
          viaIR: true,
          evmVersion: 'istanbul',
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          metadata: {
            bytecodeHash: 'none',
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      forking: {
        url: process.env.FORKING_URL,
        blockNumber: Number(process.env.BLOCK_NUMBER),
      },
    },
    arbitrum: {
      url: process.env.ARBITRUM_URL,
      accounts: [`0x${process.env.ARBITRUM_PRIVATE_KEY}`],
    },
  },
  mocha: {
    timeout: 100000000,
  },
  etherscan: {
    apiKey: process.env.ARBISCAN,
  },
};

export default config;
