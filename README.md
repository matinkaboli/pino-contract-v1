# Pino Proxy Contracts

This project consist of a number of contracts that interact with DeFi protocols.

Here's the list of the contracts:

  - Aave
  - Compound
  - Curve
  - Uniswap
  - Balancer
  - Invest
  - Swap

## Deployment

You can deploy any of the contracts mentioned above using the following command:

```shell
CONTRACT=aave NETWORK=mainnet npm run deploy
```

This command takes 2 arguments.

  1. `CONTRACT` is the name of the contract that you want to deploy. Use `camelCase` for the name of the contract. (For example `balancer` 
  2. `NETWORK` is the name of the network that is listed in `hardhat.config.ts`. This field must exist there with the right parameters.

## Verifying using Etherscan

In order to verify the newly deployed contract, use the following command:

```shell
CONTRACT=uniswap NETWORK=arbitrum ADDRESS=0x... npm run verify
```

This command takes 3 arguments.

  1. `CONTRACT` is the name of the contract that you want to deploy. Use `camelCase` for the name of the contract.
  2. `NETWORK` is the name of the network that is listed in `hardhat.config.ts`. This field must exist there with the right parameters.
  3. `ADDRESS` is the address of the deployed contract

Note: Make sure to use the right `API_KEY` for etherscan. Look at `.env.example` to get a better understanding of what you should use.

## Contracts

### Aave

Aave contract interacts with Aave V2 and V3.

### Compound

Compound contract interacts with Compound V2 and V3 (Comet).

### Curve

Curve contract interacts with Curve pools and CurveSwap contract.

### Uniswap

Uniswap contract interacts with Uniswap's NonFungiblePositionManager contract.

### Balancer

Balancer contract interacts with Balancer's Vault to work with pools and swaps.

### Invest

Invest contract interacts with StETH, WstETH, and sDai contracts.

### Swap

Swap contract interacts with Paraswap, 0x, and 1Inch swap contracts.

## ENV variables

  - `BLOCK_NUMBER` is a custom block number that hardhat uses to simulate tests in that environment for testing purposes.
  - `ETHERSCAN` is the API key of the Etherscan (or Arbiscan and so on) and is used for veriying contracts.
  - `FORKING_URL` is a RPC url that is used for mainnet forking. It is used for testing purposes.
  - `ARBITRUM_URL` is a RPC url that is used to deploy contracts on Arbitrum
  - `ARBITRUM_PRIVATE_KEY` is a private key (without `0x`) and is used to deploy contracts on Arbitrum.
  - `MAINNET_URL` is a RPC url that is used to deploy contracts on Ethereum Mainnet
  - `MAINNET_PRIVATE_KEY` is a private key (without `0x`) and is used to deploy contracts on Ethereum Mainnet
  - `ZERO_X_API_KEY` is the API key of the 0x API and is used for testing
  - `ONE_INCH_API_KEY` is the API key of the 1Inch API and is used for testing
