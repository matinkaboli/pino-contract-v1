import { ethers } from 'hardhat';

import mainnetArguments from '../arguments/mainnet/lido';
import arbitrumArguments from '../arguments/arbitrum/lido';

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

  const Invest = await ethers.getContractFactory('Invest');

  const invest = await Invest.connect(account).deploy(...args);

  await invest.deployed();

  console.log(`Invest proxy contract deployed to ${invest.address}`);
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
