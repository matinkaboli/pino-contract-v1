import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { ethers } from 'hardhat';

const NFPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const WETH = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1';
const USDC = '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8';

async function main() {
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

  const uniswap = await Uniswap.connect(account).deploy(
    PERMIT2_ADDRESS,
    WETH,
    SWAP_ROUTER,
    NFPM,
    [USDC, WETH],
  );

  await uniswap.deployed();

  console.log(uniswap);
  console.log(
    `Uniswap proxy contract deployed to ${uniswap.address}`,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
