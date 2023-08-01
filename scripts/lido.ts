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

  const Lido = await ethers.getContractFactory('Lido');

  const lido = await Lido.connect(account).deploy(...args);

  await lido.deployed();

  console.log(`Lido proxy contract deployed to ${lido.address}`);
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
