import { ethers } from 'hardhat';

import mainnetArguments from '../arguments/mainnet/uniswap';
import arbitrumArguments from '../arguments/arbitrum/uniswap';

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

  const Uniswap = await ethers.getContractFactory('Uniswap');

  const uniswap = await Uniswap.connect(account).deploy(...args);

  await uniswap.deployed();

  console.log(
    `Uniswap proxy contract deployed to ${uniswap.address}`,
  );
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
