import { ethers } from 'hardhat';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';

import mainnetArguments from '../arguments/mainnet/swapAggregators';
import arbitrumArguments from '../arguments/arbitrum/swapAggregators';

async function main() {
  const { HARDHAT_NETWORK } = process.env;

  let args = mainnetArguments;

  if (HARDHAT_NETWORK === 'arbitrum') {
    args = arbitrumArguments;
  }

  const [account] = await ethers.getSigners();

  console.log(
    'Deploying contracts with the account:',
    account.address,
  );

  console.log(
    'Account balance:',
    (await account.getBalance()).toString(),
  );

  const Swap = await ethers.getContractFactory('SwapAggregators');

  const swap = await Swap.connect(account).deploy(...args);

  await swap.deployed();

  console.log(`Swap proxy contract deployed to ${swap.address}`);
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
