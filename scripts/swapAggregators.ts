import { ethers } from 'hardhat';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';

const WETH = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'; // ARBITRUM ADDRESS OF WETH9
const Paraswap = '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57';
const OneInchV5 = '0x1111111254EEB25477B68fb85Ed929f73A960582';

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

  const SwapAgg = await ethers.getContractFactory('SwapAggregators');

  const uniswap = await SwapAgg.connect(account).deploy(
    PERMIT2_ADDRESS,
    WETH,
    OneInchV5,
    Paraswap,
  );

  await uniswap.deployed();

  console.log(uniswap);
  console.log(
    `SwapAggregator proxy contract deployed to ${uniswap.address}`,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
