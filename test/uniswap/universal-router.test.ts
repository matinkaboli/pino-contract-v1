import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { expect } from 'chai';
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { IERC20, IWETH9 } from '../../typechain-types';
import {
  USDC,
  USDT,
  DAI,
  WETH,
  WHALE3POOL,
} from '../utils/addresses.ts';
import { impersonate, signer } from '../utils/helpers';

describe('Uniswap - Universal Router', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let weth: IWETH9;
  let account: SignerWithAddress;

  const deploy = async () => {
    const contract = await ethers.getContractAt(
      'IUniversalRouter',
      UNIVERSAL_ROUTER_ADDRESS(1),
    );

    return {
      contract,
      sign: await signer(account),
    };
  };

  before(async () => {
    [account] = await ethers.getSigners();
    const whale = await impersonate(WHALE3POOL);

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    weth = await ethers.getContractAt('IWETH9', WETH);

    const amount1 = 5000n * 10n ** 6n;
    const amount2 = 5000n * 10n ** 18n;

    await dai.connect(whale).transfer(account.address, amount2);
    await usdc.connect(whale).transfer(account.address, amount1);
    await usdt.connect(whale).transfer(account.address, amount1);
    await weth.deposit({ value: amount2 });

    expect(await dai.balanceOf(account.address)).to.gte(amount2);
    expect(await weth.balanceOf(account.address)).to.gte(amount2);
    expect(await usdc.balanceOf(account.address)).to.gte(amount1);
    expect(await usdt.balanceOf(account.address)).to.gte(amount1);

    await dai.approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
    await usdc.approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
  });

  describe('V3 swaps', () => {
    it('Should swap v3 exact in USDC', async () => {
      const { contract, sign } = await loadFixture(deploy);

      console.log(contract);
    });
  });
});
