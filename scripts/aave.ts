import { ethers } from 'hardhat';

import mainnetArguments from '../arguments/mainnet/aave';
import arbitrumArguments from '../arguments/arbitrum/aave';

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

  const Aave = await ethers.getContractFactory('Aave');

  const aave = await Aave.connect(account).deploy(...args);

  await aave.deployed();

  console.log(`Aave proxy contract deployed to ${aave.address}`);
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
