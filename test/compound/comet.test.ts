import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { impersonate, signer } from '../utils/helpers';
import { IComet, IERC20, IWETH9 } from '../../typechain-types';
import {
  USDC,
  WETH,
  WBTC,
  C_USDC,
  C_ETH,
  C_USDC_V2,
  C_WBTC,
} from '../utils/addresses';

const WHALE = '0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8';
const WBTC_WHALE = '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe';

const ETH = '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

describe('Comet (Compound V3)', () => {
  let usdc: IERC20;
  let wbtc: IERC20;
  let weth: IWETH9;
  let cUsdc: IERC20;
  let cometContract: IComet;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Compound = await ethers.getContractFactory('Compound');

    const contract = await Compound.deploy(
      PERMIT2_ADDRESS,
      WETH,
      C_USDC,
      C_ETH,
      [USDC, WBTC],
      [C_USDC_V2, C_WBTC],
    );

    return {
      contract,
      sign: await signer(account),
    };
  };

  before(async () => {
    const whale = await impersonate(WHALE);
    const wbtcWhale = await impersonate(WBTC_WHALE);
    [account] = await ethers.getSigners();

    weth = await ethers.getContractAt('IWETH9', WETH);
    usdc = await ethers.getContractAt('IERC20', USDC);
    wbtc = await ethers.getContractAt('IERC20', WBTC);
    cUsdc = await ethers.getContractAt('IERC20', C_USDC);
    cometContract = await ethers.getContractAt('IComet', C_USDC);

    const amount = 5000n * 10n ** 6n;
    const ethAmount = 3n * 10n ** 18n;
    const wbtcAmount = 1000n * 10n ** 8n;

    await usdc.connect(whale).transfer(account.address, amount);
    await wbtc
      .connect(wbtcWhale)
      .transfer(account.address, wbtcAmount);
    await weth.deposit({
      value: ethAmount,
    });

    expect(await usdc.balanceOf(account.address)).to.gte(amount);
    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);
    expect(await wbtc.balanceOf(account.address)).to.gte(wbtcAmount);

    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await wbtc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await cUsdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy with 0 tokens', async () => {
      const Compound = await ethers.getContractFactory('Compound');

      await Compound.deploy(
        PERMIT2_ADDRESS,
        WETH,
        C_USDC,
        C_ETH,
        [],
        [],
      );
    });

    it('Should deploy with multiple tokens', async () => {
      const Compound = await ethers.getContractFactory('Compound');

      await Compound.deploy(
        PERMIT2_ADDRESS,
        WETH,
        C_USDC,
        C_ETH,
        [USDC],
        [C_USDC_V2],
      );
    });
  });

  describe('Supply', () => {
    it('Should supply USDC', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 200n * 10n ** 6n;
      const minimumAmount = 190n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount,
        },
        contract.address,
      );

      const cUsdcBalanceBefore = await cUsdc.balanceOf(
        account.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.depositV3(
        USDC,
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, depositTx.data]);

      expect(await cUsdc.balanceOf(account.address)).to.gt(
        cUsdcBalanceBefore.add(minimumAmount),
      );
    });

    it('Should supply WETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          token: WETH,
          amount,
        },
        contract.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.depositV3(
        WETH,
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, depositTx.data]);

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WETH,
        );

      expect(collateralBalance).to.gte(amount);
    });

    it('Should supply ETH', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 3000n;
      const amount = 1n * 10n ** 18n;

      const wrapTx = await contract.populateTransaction.wrapETH(
        proxyFee,
      );
      const depositTx = await contract.populateTransaction.depositV3(
        WETH,
        amount,
        account.address,
      );

      await contract.multicall([wrapTx.data, depositTx.data], {
        value: amount + proxyFee,
      });

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WETH,
        );

      expect(collateralBalance).to.gte(amount);
    });

    it('Should supply WBTC', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 500n * 10n ** 8n;

      const { permit, signature } = await sign(
        {
          token: WBTC,
          amount,
        },
        contract.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.depositV3(
        WBTC,
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, depositTx.data]);

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WBTC,
        );

      expect(collateralBalance).to.gte(amount);
    });
  });

  describe('Withdraw', () => {
    it('Should supply USDC and withdraw it', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 200n * 10n ** 6n;
      const minimumAmount = 190n * 10n ** 6n;

      const cUsdcBalanceBefore = await cUsdc.balanceOf(
        account.address,
      );

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount,
        },
        contract.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.depositV3(
        USDC,
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, depositTx.data]);

      const cUsdcBalanceAfter = await cUsdc.balanceOf(
        account.address,
      );

      expect(cUsdcBalanceAfter).to.gt(
        cUsdcBalanceBefore.add(minimumAmount),
      );

      await cometContract.allow(contract.address, true);

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const withdrawTx =
        await contract.populateTransaction.withdrawV3(
          USDC,
          cUsdcBalanceAfter,
          account.address,
        );

      await contract.multicall([withdrawTx.data]);

      const usdcBalanceAfter = await usdc.balanceOf(account.address);

      expect(usdcBalanceAfter).to.gt(usdcBalanceBefore);
    });

    it('Should supply WBTC and withdraw it', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 5n * 10n ** 8n;

      const { permit, signature } = await sign(
        {
          token: WBTC,
          amount,
        },
        contract.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.depositV3(
        WBTC,
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, depositTx.data]);

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WBTC,
        );

      expect(collateralBalance).to.gte(amount);

      await cometContract.allow(contract.address, true);

      const wbtcBalanceBefore = await wbtc.balanceOf(account.address);

      const withdrawTx =
        await contract.populateTransaction.withdrawV3(
          WBTC,
          collateralBalance,
          account.address,
        );

      await contract.multicall([withdrawTx.data]);

      expect(await wbtc.balanceOf(account.address)).to.gt(
        wbtcBalanceBefore,
      );
    });

    it('Should supply WETH and withdraw it', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 500n * 10n ** 8n;

      const { permit, signature } = await sign(
        {
          token: WETH,
          amount,
        },
        contract.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.depositV3(
        WETH,
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, depositTx.data]);

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WETH,
        );

      expect(collateralBalance).to.gte(amount);

      await cometContract.allow(contract.address, true);

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const withdrawTx =
        await contract.populateTransaction.withdrawV3(
          WETH,
          collateralBalance,
          account.address,
        );

      await contract.multicall([withdrawTx.data]);

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);
    });

    it('Should supply WETH and withdraw ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 20n * 10n ** 16n;
      const minimumAmount = 17n * 10n ** 16n;

      const { permit, signature } = await sign(
        {
          token: WETH,
          amount,
        },
        contract.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.depositV3(
        WETH,
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, depositTx.data]);

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WETH,
        );

      expect(collateralBalance).to.gte(amount);

      await cometContract.allow(contract.address, true);

      const balanceBefore = await ethers.provider.getBalance(
        account.address,
      );

      const withdrawTx =
        await contract.populateTransaction.withdrawV3(
          WETH,
          collateralBalance,
          contract.address,
        );
      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      await contract.multicall([withdrawTx.data, unwrapTx.data]);

      const balanceAfter = await ethers.provider.getBalance(
        account.address,
      );

      expect(balanceAfter).to.gt(balanceBefore.add(minimumAmount));
    });

    it('Should supply ETH and withdraw ETH', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 3000n;
      const amount = 1n * 10n ** 18n;
      const minimumAmount = 1n * 10n ** 17n;

      const wrapTx = await contract.populateTransaction.wrapETH(
        proxyFee,
      );
      const depositTx = await contract.populateTransaction.depositV3(
        WETH,
        amount,
        account.address,
      );

      await contract.multicall([wrapTx.data, depositTx.data], {
        value: amount + proxyFee,
      });

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WETH,
        );

      expect(collateralBalance).to.gte(amount);

      await cometContract.allow(contract.address, true);

      const balanceBefore = await account.getBalance();

      const withdrawTx =
        await contract.populateTransaction.withdrawV3(
          WETH,
          collateralBalance,
          contract.address,
        );
      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      await contract.multicall([withdrawTx.data, unwrapTx.data]);

      expect(await account.getBalance()).to.gt(
        balanceBefore.add(minimumAmount),
      );
    });
  });

  describe('Repay', () => {
    it('Should supply WBTC, borrow USDC, and repay USDC', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 8n;
      const minimumAmount = 1n * 10n ** 7n;

      const wbtcBalanceBefore =
        await cometContract.collateralBalanceOf(
          account.address,
          WBTC,
        );

      const { permit, signature } = await sign(
        {
          token: WBTC,
          amount,
        },
        contract.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.depositV3(
        WBTC,
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, depositTx.data]);

      const wbtcBalanceAfter =
        await cometContract.collateralBalanceOf(
          account.address,
          WBTC,
        );

      expect(wbtcBalanceAfter).to.gt(
        wbtcBalanceBefore.add(minimumAmount),
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const borrowAmount = 200n * 10n ** 6n;

      const borrowTx = await contract.populateTransaction.withdrawV3(
        USDC,
        borrowAmount,
        account.address,
      );

      // Allow the Pino proxy contract to be able to borrow for the user and send it to the user
      await cometContract.allow(contract.address, true);

      // Borrow from Compound, send it to account.data
      await contract.multicall([borrowTx.data]);

      const usdcBalanceAfter = await usdc.balanceOf(account.address);

      expect(usdcBalanceAfter).to.gt(usdcBalanceBefore);
    });

    it('Should supply WBTC, borrow ETH, and repay ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 8n;
      const minimumAmount = 1n * 10n ** 7n;

      const wbtcBalanceBefore =
        await cometContract.collateralBalanceOf(
          account.address,
          WBTC,
        );

      const { permit, signature } = await sign(
        {
          token: WBTC,
          amount,
        },
        contract.address,
      );

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const depositTx = await contract.populateTransaction.depositV3(
        WBTC,
        amount,
        account.address,
      );

      await contract.multicall([permitTx.data, depositTx.data]);

      const wbtcBalanceAfter =
        await cometContract.collateralBalanceOf(
          account.address,
          WBTC,
        );

      expect(wbtcBalanceAfter).to.gt(
        wbtcBalanceBefore.add(minimumAmount),
      );

      // const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const borrowAmount = 1n * 10n ** 18n;

      const borrowTx = await contract.populateTransaction.withdrawV3(
        WETH,
        borrowAmount,
        contract.address,
      );
      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      // Allow the Pino proxy contract to be able to borrow for the user and send it to the user
      await cometContract.allow(contract.address, true);

      // Borrow from Compound, send it to account.data
      await contract.multicall([unwrapTx.data, borrowTx.data]);

      const usdcBalanceAfter = await usdc.balanceOf(account.address);

      expect(usdcBalanceAfter).to.gt(usdcBalanceBefore);
    });
  });

  describe('Admin', () => {
    it('Should withdraw money', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await account.sendTransaction({
        to: contract.address,
        value: amount,
      });

      const balanceBefore = await account.getBalance();

      await contract.withdrawAdmin(account.address);

      const balanceAfter = await account.getBalance();

      expect(balanceAfter).to.gt(balanceBefore);
    });
  });
});
