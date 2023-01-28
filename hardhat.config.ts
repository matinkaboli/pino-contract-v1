import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      forking: {
        url: "https://eth-mainnet.g.alchemy.com/v2/xrxGy3kXIcTKv3wH2k18tAuh26iC-HxG",
      },
    },
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
