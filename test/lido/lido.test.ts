import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

import { signer } from '../utils/helpers';
import { IERC20, IWETH9 } from '../../typechain-types';
import { WETH, WST_ETH, ST_ETH } from '../utils/addresses';

describe('Lido', () => {
  let weth: IWETH9;
  let steth: IERC20;
  let wsteth: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Lido = await ethers.getContractFactory('Lido');

    const contract = await Lido.deploy(
      PERMIT2_ADDRESS,
      WETH,
      ST_ETH,
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
        WETH,
        ST_ETH,
        WST_ETH,
      );

      const lido = await contract.StETH();

      expect(lido.toLowerCase()).to.equal(ST_ETH.toLowerCase());
    });
  });

  describe('Convert ETH', () => {
    it('Should convert ETH to wstETH', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 0n;
      const amount = 1n * 10n ** 18n;

      const wstBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.ethToWstETH(proxyFee, account.address, {
        value: amount + proxyFee,
      });

      const wstBalanceAfter = await wsteth.balanceOf(account.address);

      expect(wstBalanceAfter).to.gt(wstBalanceBefore);
    });

    it('Should convert ETH to wstETH with proxy fee', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 10000n;
      const amount = 1n * 10n ** 18n;

      const wstBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.ethToWstETH(proxyFee, account.address, {
        value: amount + proxyFee,
      });

      const wstBalanceAfter = await wsteth.balanceOf(account.address);

      expect(wstBalanceAfter).to.gt(wstBalanceBefore);
    });

    it('Should convert ETH to stETH', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 0n;
      const amount = 1n * 10n ** 18n;

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.ethToStETH(proxyFee, account.address, {
        value: amount + proxyFee,
      });

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });

    it('Should convert ETH to stETH with proxy fee', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 5000n;
      const amount = 1n * 10n ** 18n;

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.ethToStETH(proxyFee, account.address, {
        value: amount + proxyFee,
      });

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

      await contract.wethToStETH(account.address, permit, signature);

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });

    it('Should convert WETH to stETH with proxy fee', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const proxyFee = 200n;
      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: WETH, amount },
        contract.address,
      );

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.wethToStETH(account.address, permit, signature, {
        value: proxyFee,
      });

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });

    it('Should convert WETH to wstETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const proxyFee = 200n;
      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: WETH, amount },
        contract.address,
      );

      const wstethBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.wethToWstETH(
        account.address,
        permit,
        signature,
        { value: proxyFee },
      );

      const wstethBalanceAfter = await wsteth.balanceOf(
        account.address,
      );

      expect(wstethBalanceAfter).to.gt(wstethBalanceBefore);
    });

    it('Should convert WETH to wstETH with proxy fee', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const proxyFee = 200n;
      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: WETH, amount },
        contract.address,
      );

      const wstethBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      await contract.wethToWstETH(
        account.address,
        permit,
        signature,
        { value: proxyFee },
      );

      const wstethBalanceAfter = await wsteth.balanceOf(
        account.address,
      );

      expect(wstethBalanceAfter).to.gt(wstethBalanceBefore);
    });
  });

  describe('Convert ST_ETH', () => {
    it('Should convert ST_ETH to WST_ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const proxyFee = 0n;
      const amount = 1n * 10n ** 18n;

      await contract.ethToStETH(proxyFee, account.address, {
        value: amount + proxyFee,
      });

      const { permit, signature } = await sign(
        { token: ST_ETH, amount },
        contract.address,
      );

      const wstethBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const wrapTx = await contract.populateTransaction.stETHToWstETH(
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, wrapTx.data]);

      const wstethBalanceAfter = await wsteth.balanceOf(
        account.address,
      );

      expect(wstethBalanceAfter).to.gt(wstethBalanceBefore);
    });

    it('Should convert ST_ETH to WST_ETH with proxy fee', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const proxyFee = 100n;
      const amount = 1n * 10n ** 18n;

      await contract.ethToStETH(proxyFee, account.address, {
        value: amount + proxyFee,
      });

      const { permit, signature } = await sign(
        { token: ST_ETH, amount },
        contract.address,
      );

      const wstethBalanceBefore = await wsteth.balanceOf(
        account.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const wrapTx = await contract.populateTransaction.stETHToWstETH(
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, wrapTx.data], {
        value: proxyFee,
      });

      const wstethBalanceAfter = await wsteth.balanceOf(
        account.address,
      );

      expect(wstethBalanceAfter).to.gt(wstethBalanceBefore);
    });
  });

  describe('Convert WST_ETH', () => {
    it('Should convert WST_ETH to ST_ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const proxyFee = 0n;
      const amount = 1n * 10n ** 18n;

      await contract.ethToWstETH(proxyFee, account.address, {
        value: amount + proxyFee,
      });

      const wstBalance = await wsteth.balanceOf(account.address);

      const { permit, signature } = await sign(
        { token: WST_ETH, amount: wstBalance },
        contract.address,
      );

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const wrapTx = await contract.populateTransaction.wstETHToStETH(
        wstBalance,
        account.address,
      );

      await contract.multicall([permitTx.data, wrapTx.data]);

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });

    it('Should convert WST_ETH to ST_ETH with proxy fee', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const proxyFee = 0n;
      const amount = 1n * 10n ** 18n;

      await contract.ethToWstETH(proxyFee, account.address, {
        value: amount + proxyFee,
      });

      const wstBalance = await wsteth.balanceOf(account.address);

      const { permit, signature } = await sign(
        { token: WST_ETH, amount: wstBalance },
        contract.address,
      );

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const wrapTx = await contract.populateTransaction.wstETHToStETH(
        wstBalance,
        account.address,
      );

      await contract.multicall([permitTx.data, wrapTx.data], {
        value: 200,
      });

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });
  });
});
