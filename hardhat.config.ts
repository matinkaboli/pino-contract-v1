import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

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
        url: 'https://eth-mainnet.g.alchemy.com/v2/xrxGy3kXIcTKv3wH2k18tAuh26iC-HxG',
        blockNumber: 17004390,
      },
    },
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
