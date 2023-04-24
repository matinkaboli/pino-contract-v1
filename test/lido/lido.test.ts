import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { WETH, WST_ETH, ST_ETH } from '../utils/addresses';
import { signer } from '../utils/helpers';
import { IERC20, IWETH9 } from '../../typechain-types';

describe('Lido', () => {
  let weth: IWETH9;
  let steth: IERC20;
  let wsteth: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Lido = await ethers.getContractFactory('Lido');

    const contract = await Lido.deploy(
      PERMIT2_ADDRESS,
      ST_ETH,
      WETH,
      WST_ETH,
    );

    return { contract, sign: await signer(account) };
  };

  before(async () => {
    [account] = await ethers.getSigners();

    weth = await ethers.getContractAt('IWETH9', WETH);
    steth = await ethers.getContractAt('IERC20', ST_ETH);
    wsteth = await ethers.getContractAt('IERC20', WST_ETH);

    const ethAmount = 3n * 10n ** 18n;

    await weth.deposit({
      value: ethAmount,
    });

    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);

    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await steth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await wsteth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy Lido contract', async () => {
      const Lido = await ethers.getContractFactory('Lido');

      const contract = await Lido.deploy(
        PERMIT2_ADDRESS,
        ST_ETH,
        WETH,
        WST_ETH,
      );

      const lido = await contract.StETH();

      expect(lido.toLowerCase()).to.equal(ST_ETH.toLowerCase());
    });
  });

  describe('Convert ETH', () => {
    it('Should convert ETH to wstETH', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const wstBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.ethToWstETH(0, { value: amount });

      const wstBalanceAfter = await wsteth.balanceOf(account.address);

      expect(wstBalanceAfter).to.gt(wstBalanceBefore);
    });

    it('Should convert ETH to wstETH with proxy fee', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const wstBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.ethToWstETH(10000, { value: amount });

      const wstBalanceAfter = await wsteth.balanceOf(account.address);

      expect(wstBalanceAfter).to.gt(wstBalanceBefore);
    });

    it('Should convert ETH to stETH', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.ethToStETH(0, { value: amount });

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });

    it('Should convert ETH to stETH with proxy fee', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.ethToStETH(5000, { value: amount });

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });
  });

  describe('Convert WETH', () => {
    it('Should convert WETH to stETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: WETH, amount },
        contract.address,
      );

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.wethToStETH(permit, signature);

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });

    it('Should convert WETH to stETH with proxy fee', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: WETH, amount },
        contract.address,
      );

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.wethToStETH(permit, signature, { value: 200 });

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });

    it('Should convert WETH to wstETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: WETH, amount },
        contract.address,
      );

      const wstethBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.wethToWstETH(permit, signature, { value: 200 });

      const wstethBalanceAfter = await wsteth.balanceOf(
        account.address,
      );

      expect(wstethBalanceAfter).to.gt(wstethBalanceBefore);
    });

    it('Should convert WETH to wstETH with proxy fee', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: WETH, amount },
        contract.address,
      );

      const wstethBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.wethToWstETH(permit, signature, { value: 200 });

      const wstethBalanceAfter = await wsteth.balanceOf(
        account.address,
      );

      expect(wstethBalanceAfter).to.gt(wstethBalanceBefore);
    });
  });

  describe('Convert ST_ETH', () => {
    it('Should convert ST_ETH to WST_ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      await contract.ethToStETH(0, { value: amount });

      const { permit, signature } = await sign(
        { token: ST_ETH, amount },
        contract.address,
      );

      const wstethBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.stETHToWstETH(permit, signature);

      const wstethBalanceAfter = await wsteth.balanceOf(
        account.address,
      );

      expect(wstethBalanceAfter).to.gt(wstethBalanceBefore);
    });

    it('Should convert ST_ETH to WST_ETH with proxy fee', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      await contract.ethToStETH(0, { value: amount });

      const { permit, signature } = await sign(
        { token: ST_ETH, amount },
        contract.address,
      );

      const wstethBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.stETHToWstETH(permit, signature, { value: 100 });

      const wstethBalanceAfter = await wsteth.balanceOf(
        account.address,
      );

      expect(wstethBalanceAfter).to.gt(wstethBalanceBefore);
    });
  });

  describe('Convert WST_ETH', () => {
    it('Should convert WST_ETH to ST_ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      await contract.ethToWstETH(0, { value: amount });

      const wstBalance = await wsteth.balanceOf(account.address);

      const { permit, signature } = await sign(
        { token: WST_ETH, amount: wstBalance },
        contract.address,
      );

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.wstETHToStETH(permit, signature);

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });

    it('Should convert WST_ETH to ST_ETH with proxy fee', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      await contract.ethToWstETH(0, { value: amount });

      const wstBalance = await wsteth.balanceOf(account.address);

      const { permit, signature } = await sign(
        { token: WST_ETH, amount: wstBalance },
        contract.address,
      );

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.wstETHToStETH(permit, signature, { value: 200 });

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });
  });
});
