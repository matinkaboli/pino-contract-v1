import { ethers } from 'hardhat';

import mainnetArguments from '../arguments/mainnet/compound';
import arbitrumArguments from '../arguments/arbitrum/compound';

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

  const Compound = await ethers.getContractFactory('Compound');

  const compound = await Compound.connect(account).deploy(...args);

  await compound.deployed();

  console.log(
    `Compound proxy contract deployed to ${compound.address}`,
  );
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
