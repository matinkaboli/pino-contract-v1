// Comet
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { impersonate, signer } from '../utils/helpers';
import { IERC20, IWETH9 } from '../../typechain-types';
import { IComet } from '../../typechain-types/contracts/Comet/Comet.sol';
import {
  USDC,
  C_USDC,
  LINK,
  COMP,
  WETH,
  UNI,
  WBTC,
} from '../utils/addresses';

const WHALE = '0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8';
const WBTC_WHALE = '0x845cbcb8230197f733b59cfe1795f282786f212c';

describe('Comet (Compound V3)', () => {
  let usdc: IERC20;
  let wbtc: IERC20;
  let weth: IWETH9;
  let cUsdc: IERC20;
  let cometContract: IComet;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Comet = await ethers.getContractFactory('Comet');
    const contract = await Comet.deploy(
      C_USDC,
      WETH,
      PERMIT2_ADDRESS,
      [USDC, WETH, WBTC],
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
      const Comet = await ethers.getContractFactory('Comet');

      await Comet.deploy(C_USDC, WETH, PERMIT2_ADDRESS, []);
    });

    it('Should deploy with multiple tokens', async () => {
      const Comet = await ethers.getContractFactory('Comet');

      await Comet.deploy(C_USDC, WETH, PERMIT2_ADDRESS, [USDC, WETH]);
    });

    it('Should deploy with all comet tokens', async () => {
      const Comet = await ethers.getContractFactory('Comet');

      await Comet.deploy(C_USDC, WETH, PERMIT2_ADDRESS, [
        USDC,
        LINK,
        COMP,
        WETH,
        UNI,
        WBTC,
      ]);
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

      await contract.supply(permit, signature);
      // gasUsed: 170k

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

      await contract.supply(permit, signature);
      // gasUsed: 159k

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WETH,
        );

      expect(collateralBalance).to.gte(amount);
    });

    it('Should supply ETH', async () => {
      const { contract } = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 1n * 10n ** 18n;

      await contract.supplyETH(fee, {
        value: amount + fee,
      });
      // gasUsed: 124k

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

      await contract.supply(permit, signature);
      // gasUsed: 168k

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

      await contract.supply(permit, signature);

      const cUsdcBalanceAfter = await cUsdc.balanceOf(
        account.address,
      );

      expect(cUsdcBalanceAfter).to.gt(
        cUsdcBalanceBefore.add(minimumAmount),
      );

      await cometContract.allow(contract.address, true);
      // gasUsed: 57k

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await contract.withdraw(USDC, cUsdcBalanceAfter);
      // gasUsed: 92k

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

      await contract.supply(permit, signature);
      // gasUsed: 160k

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WBTC,
        );

      expect(collateralBalance).to.gte(amount);

      await cometContract.allow(contract.address, true);
      // gasUsed: 57k

      const wbtcBalanceBefore = await wbtc.balanceOf(account.address);

      await contract.withdraw(WBTC, collateralBalance);
      // gasUsed: 92k

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

      await contract.supply(permit, signature);
      // gasUsed: 160k

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WETH,
        );

      expect(collateralBalance).to.gte(amount);

      await cometContract.allow(contract.address, true);
      // gasUsed: 57k

      const wethBalanceBefore = await weth.balanceOf(account.address);

      await contract.withdraw(WETH, collateralBalance);
      // gasUsed: 92k

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

      await contract.supply(permit, signature);
      // gasUsed: 160k

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WETH,
        );

      expect(collateralBalance).to.gte(amount);

      await cometContract.allow(contract.address, true);
      // gasUsed: 57k

      const balanceBefore = await ethers.provider.getBalance(
        account.address,
      );

      await contract.withdrawETH(collateralBalance);
      // gasUsed: 93k

      const balanceAfter = await ethers.provider.getBalance(
        account.address,
      );

      expect(balanceAfter).to.gt(balanceBefore.add(minimumAmount));
    });

    it('Should supply ETH and withdraw ETH', async () => {
      const { contract } = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 20n * 10n ** 16n;
      const minimumAmount = 18n * 10n ** 16n;

      await contract.supplyETH(fee, {
        value: amount + fee,
      });
      // gasUsed: 124k

      const collateralBalance =
        await cometContract.collateralBalanceOf(
          account.address,
          WETH,
        );

      expect(collateralBalance).to.gte(amount);

      await cometContract.allow(contract.address, true);
      // gasUsed: 57k

      const balanceBefore = await account.getBalance();

      await contract.withdrawETH(collateralBalance);
      // gasUsed: 93k

      expect(await account.getBalance()).to.gt(
        balanceBefore.add(minimumAmount),
      );
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

      await contract.withdrawAdmin();

      const balanceAfter = await account.getBalance();

      expect(balanceAfter).to.gt(balanceBefore);
    });
  });
});
