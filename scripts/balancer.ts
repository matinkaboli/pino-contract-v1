import { ethers } from 'hardhat';

import mainnetArguments from '../arguments/mainnet/balancer';
import arbitrumArguments from '../arguments/arbitrum/balancer';

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

  const Balancer = await ethers.getContractFactory('Balancer');

  const balancer = await Balancer.connect(account).deploy(...args);

  await balancer.deployed();

  console.log(`Aave proxy contract deployed to ${balancer.address}`);
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
