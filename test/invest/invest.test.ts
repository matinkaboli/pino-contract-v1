import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

import { impersonate, signer } from '../utils/helpers';
import { IERC20, IWETH9 } from '../../typechain-types';
import {
  WETH,
  WST_ETH,
  ST_ETH,
  DAI,
  WHALE3POOL,
} from '../utils/addresses';

const S_DAI = '0x83F20F44975D03b1b09e64809B757c47f942BEeA';

describe('Invest', () => {
  let dai: IERC20;
  let sDai: IERC20;
  let weth: IWETH9;
  let steth: IERC20;
  let wsteth: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Invest = await ethers.getContractFactory('Invest');

    const contract = await Invest.deploy(
      PERMIT2_ADDRESS,
      WETH,
      ST_ETH,
      WST_ETH,
      S_DAI,
    );

    return { contract, sign: await signer(account) };
  };

  before(async () => {
    const whale = await impersonate(WHALE3POOL);
    [account] = await ethers.getSigners();

    dai = await ethers.getContractAt('IERC20', DAI);
    weth = await ethers.getContractAt('IWETH9', WETH);
    sDai = await ethers.getContractAt('IERC20', S_DAI);
    steth = await ethers.getContractAt('IERC20', ST_ETH);
    wsteth = await ethers.getContractAt('IERC20', WST_ETH);

    const daiAmount = 5000n * 10n ** 18n;
    await dai.connect(whale).transfer(account.address, daiAmount);
    expect(await dai.balanceOf(account.address)).to.gte(daiAmount);

    const ethAmount = 3n * 10n ** 18n;
    await weth.deposit({
      value: ethAmount,
    });
    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);

    await dai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await sDai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await steth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await wsteth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy Invest contract', async () => {
      const Invest = await ethers.getContractFactory('Invest');

      const contract = await Invest.deploy(
        PERMIT2_ADDRESS,
        WETH,
        ST_ETH,
        WST_ETH,
        S_DAI,
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

      await contract.ethToWstETH(account.address, proxyFee, {
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

      await contract.ethToWstETH(account.address, proxyFee, {
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

      await contract.ethToStETH(account.address, proxyFee, {
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

      await contract.ethToStETH(account.address, proxyFee, {
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

      await contract.ethToStETH(account.address, proxyFee, {
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

      await contract.ethToStETH(account.address, proxyFee, {
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

      await contract.ethToWstETH(account.address, proxyFee, {
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

      await contract.ethToWstETH(account.address, proxyFee, {
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

  describe('DAI to sDAI', () => {
    it('Should convert DAI to S_DAI', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 200n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: DAI, amount },
        contract.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(DAI, [S_DAI]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.daiToSDai(
        amount,
        account.address,
      );

      const sDaiBalanceBefore = await sDai.balanceOf(account.address);

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        depositTx.data,
      ]);

      const sDaiBalanceAfter = await sDai.balanceOf(account.address);

      expect(sDaiBalanceAfter).to.gt(sDaiBalanceBefore);
    });

    it('Should convert S_DAI to DAI', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 200n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: DAI, amount },
        contract.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(DAI, [S_DAI]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.daiToSDai(
        amount,
        account.address,
      );

      const sDaiBalanceBefore = await sDai.balanceOf(account.address);

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        depositTx.data,
      ]);

      const sDaiBalanceAfter = await sDai.balanceOf(account.address);

      expect(sDaiBalanceAfter).to.gt(sDaiBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        { token: S_DAI, amount: sDaiBalanceAfter },
        contract.address,
      );

      const permitTx2 =
        await contract.populateTransaction.permitTransferFrom(
          permit2,
          signature2,
        );
      const withdrawTx = await contract.populateTransaction.sDaiToDai(
        sDaiBalanceAfter,
        account.address,
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);

      await contract.multicall([permitTx2.data, withdrawTx.data]);

      const daiBalanceAfter = await dai.balanceOf(account.address);

      expect(daiBalanceAfter).to.gt(daiBalanceBefore);
    });
  });
});
