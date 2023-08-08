import { ethers } from 'hardhat';

import mainnetArguments from '../arguments/mainnet/curve';
import arbitrumArguments from '../arguments/arbitrum/curve';

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

  const Curve = await ethers.getContractFactory('Curve');

  const curve = await Curve.connect(account).deploy(...args);

  await curve.deployed();

  console.log(`Curve proxy contract deployed to ${curve.address}`);
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
