import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
//
// const DEFAULT_COMPILER_SETTINGS = {
//   version: "0.7.6",
//   settings: {
//     evmVersion: "istanbul",
//     optimizer: {
//       enabled: true,
//       runs: 1_000_000,
//     },
//     metadata: {
//       bytecodeHash: "none",
//     },
//   },
// };

const config: HardhatUserConfig = {
  // solidity: {
  //   compilers: [DEFAULT_COMPILER_SETTINGS],
  // },
  solidity: "0.8.16",
  networks: {
    hardhat: {
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      forking: {
        url: "https://eth-mainnet.g.alchemy.com/v2/TOKEN",
      },
    },
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
