import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-network-helpers';
import {
  DAI,
  USDC,
  USDT,
  WETH,
  A_DAI,
  A_USDC,
  A_USDT,
  A_WETH,
  tokens,
  WHALE3POOL,
} from '../utils/addresses';
import { IERC20 } from '../../typechain-types';
import { impersonate, signer } from '../utils/helpers';
import { ILendingPool } from '../../typechain-types/contracts/Aave/LendingPool.sol';
import { IWethGateway } from '../../typechain-types/contracts/Aave/LendingPool2.sol';

const LENDING_POOL = '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9';
const WETH_GATEWAY = '0xEFFC18fC3b7eb8E676dac549E0c693ad50D1Ce31';

describe('Aave - V2', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let aDai: IERC20;
  let aUsdc: IERC20;
  let aUsdt: IERC20;
  let aWeth: IERC20;
  let weth: Contract;
  let aave: ILendingPool;
  let wethGateway: IWethGateway;
  let account: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const deploy = async () => {
    const AaveV2 = await ethers.getContractFactory('AaveV2');

    const contract = await AaveV2.deploy(
      PERMIT2_ADDRESS,
      WETH,
      LENDING_POOL,
      WETH_GATEWAY,
      [USDC, USDT, A_USDC, A_USDT],
    );

    await contract.approveToken(DAI, [LENDING_POOL]);
    await contract.approveToken(A_DAI, [LENDING_POOL]);
    await contract.approveToken(WETH, [LENDING_POOL, WETH_GATEWAY]);
    await contract.approveToken(A_WETH, [LENDING_POOL, WETH_GATEWAY]);

    return { contract, sign: await signer(account) };
  };

  before(async () => {
    const whale = await impersonate(WHALE3POOL);
    [account, otherAccount] = await ethers.getSigners();

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    aDai = await ethers.getContractAt('IERC20', A_DAI);
    weth = await ethers.getContractAt('IWETH9', WETH);
    aUsdc = await ethers.getContractAt('IERC20', A_USDC);
    aUsdt = await ethers.getContractAt('IERC20', A_USDT);
    aWeth = await ethers.getContractAt('IERC20', A_WETH);
    aave = await ethers.getContractAt('ILendingPool', LENDING_POOL);
    wethGateway = await ethers.getContractAt(
      'IWethGateway',
      WETH_GATEWAY,
    );

    const ethAmount = 3n * 10n ** 18n;
    const daiAmount = 5000n * 10n ** 18n;
    const usdtAmount = 5000n * 10n ** 6n;
    const usdcAmount = 1500n * 10n ** 6n;

    await usdc.connect(whale).transfer(account.address, usdcAmount);
    await usdt.connect(whale).transfer(account.address, usdtAmount);
    await dai.connect(whale).transfer(account.address, daiAmount);
    await weth.deposit({
      value: ethAmount,
    });

    expect(await usdc.balanceOf(account.address)).to.gte(usdcAmount);
    expect(await usdt.balanceOf(account.address)).to.gte(usdtAmount);
    expect(await dai.balanceOf(account.address)).to.gte(daiAmount);
    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);

    await dai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await aDai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await aUsdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await aUsdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await aWeth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy with 0 tokens', async () => {
      const LendingPool = await ethers.getContractFactory('AaveV2');

      await LendingPool.deploy(
        PERMIT2_ADDRESS,
        WETH,
        LENDING_POOL,
        WETH_GATEWAY,
        [],
      );
    });

    it('Should deploy with multiple tokens', async () => {
      const LendingPool = await ethers.getContractFactory('AaveV2');

      await LendingPool.deploy(
        PERMIT2_ADDRESS,
        WETH,
        LENDING_POOL,
        WETH_GATEWAY,
        [DAI, USDC, A_DAI, A_USDC],
      );
    });

    it('Should deploy with all aave tokens and aTokens', async () => {
      const LendingPool = await ethers.getContractFactory('AaveV2');

      await LendingPool.deploy(
        PERMIT2_ADDRESS,
        WETH,
        LENDING_POOL,
        WETH_GATEWAY,
        tokens,
        {
          gasLimit: 10_000_000,
        },
      );
    });
  });

  describe('Supply', () => {
    it('Should supply USDC', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;

      const { signature, permit } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const aUsdcBalance = await aUsdc.balanceOf(account.address);

      await contract.supply(permit, signature);

      expect(await aUsdc.balanceOf(account.address)).to.gt(
        aUsdcBalance,
      );
    });

    it('Should supply USDT', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;

      const { signature, permit } = await sign(
        {
          amount,
          token: USDT,
        },
        contract.address,
      );

      const aUsdtBalance = await aUsdt.balanceOf(account.address);

      await contract.supply(permit, signature);

      expect(await aUsdt.balanceOf(account.address)).to.gt(
        aUsdtBalance,
      );
    });

    it('Should supply DAI', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 18n;

      const { signature, permit } = await sign(
        {
          amount,
          token: DAI,
        },
        contract.address,
      );

      const aDaiBalance = await aDai.balanceOf(account.address);

      await contract.supply(permit, signature);

      expect(await aDai.balanceOf(account.address)).to.gt(
        aDaiBalance,
      );
    });

    it('Should supply WETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { signature, permit } = await sign(
        {
          amount,
          token: WETH,
        },
        contract.address,
      );

      const aWethBalance = await aWeth.balanceOf(account.address);

      await contract.supply(permit, signature);

      expect(await aWeth.balanceOf(account.address)).to.gt(
        aWethBalance,
      );
    });

    it('Should supply ETH directly', async () => {
      const { contract } = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 18n;
      const minimumAmount = 9n * 10n ** 18n;

      const aWethBalanceBefore = await aWeth.balanceOf(
        account.address,
      );

      await contract.supplyETH(fee, {
        value: amount - fee,
      });

      const aWethBalanceAfter = await aWeth.balanceOf(
        account.address,
      );

      expect(aWethBalanceAfter).to.gte(
        aWethBalanceBefore.add(minimumAmount),
      );
    });
  });

  describe('Repay', () => {
    it('Should supply USDC and borrow DAI', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;

      const sign0 = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      await contract.supply(sign0.permit, sign0.signature);

      const borrowAmount = 200n * 10n ** 18n;

      const daiBalanceBefore = await dai.balanceOf(account.address);

      await aave.borrow(DAI, borrowAmount, 1, 0, account.address);

      const daiBalanceAfter = await dai.balanceOf(account.address);

      expect(daiBalanceAfter).to.gt(daiBalanceBefore);

      const sign1 = await sign(
        {
          token: DAI,
          amount: 500n * 10n ** 18n,
        },
        contract.address,
      );

      await contract.repay(1, sign1.permit, sign1.signature);
    });

    it('Should supply USDC and borrow ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;

      const sign0 = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      await contract.supply(sign0.permit, sign0.signature);

      const borrowAmount = 1n * 10n ** 16n;

      const wethBalanceBefore = await weth.balanceOf(account.address);

      // await wethGateway.borrowETH(LENDING_POOL, borrowAmount, 2, 0);
      await aave.borrow(WETH, borrowAmount, 1, 0, account.address);

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);

      await contract.repayETH(1, 0, {
        value: borrowAmount,
      });
    });

    it('Should supply USDC and borrow ETH using repayETH2', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;

      const sign0 = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      await contract.supply(sign0.permit, sign0.signature);

      const borrowAmount = 1n * 10n ** 16n;

      const wethBalanceBefore = await weth.balanceOf(account.address);

      // await wethGateway.borrowETH(LENDING_POOL, borrowAmount, 2, 0);
      await aave.borrow(WETH, borrowAmount, 1, 0, account.address);

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);

      // await contract.approveToken(WETH, [LENDING_POOL]);

      await contract.repayETH(1, 0, {
        value: borrowAmount * 2n,
      });
    });
  });

  describe('Withdraw', () => {
    it('Should supply USDC and withdraw it', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;
      const minimumAmount = 90n * 10n ** 6n;

      const { signature, permit } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const aUsdcBalanceBefore = await aUsdc.balanceOf(
        account.address,
      );

      await contract.supply(permit, signature);

      const aUsdcBalanceAfter = await aUsdc.balanceOf(
        account.address,
      );

      expect(aUsdcBalanceAfter).to.gt(aUsdcBalanceBefore);

      const { signature: signature2, permit: permit2 } = await sign(
        {
          token: A_USDC,
          amount: aUsdcBalanceAfter,
        },
        contract.address,
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await contract.withdraw(permit2, signature2, USDC);

      expect(await usdc.balanceOf(account.address)).to.gt(
        usdcBalanceBefore.add(minimumAmount),
      );
    });

    it('Should supply DAI and withdraw it after 1 year', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;
      const minimumAmount = 101n * 10n ** 18n;

      const { signature, permit } = await sign(
        {
          amount,
          token: DAI,
        },
        contract.address,
      );

      const aDaiBalanceBefore = await aDai.balanceOf(account.address);

      await contract.supply(permit, signature);

      expect(await aDai.balanceOf(account.address)).to.gt(
        aDaiBalanceBefore,
      );

      // Increate the time to 2 years to get some APY
      const TWO_YEAR_AFTER = 60 * 60 * 24 * 365 * 2;
      const now = await time.latest();
      await time.increaseTo(now + TWO_YEAR_AFTER);

      const aDaiBalanceAfter2 = await aDai.balanceOf(account.address);

      const { signature: signature2, permit: permit2 } = await sign(
        {
          token: A_DAI,
          amount: aDaiBalanceAfter2,
        },
        contract.address,
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);

      await contract.withdraw(permit2, signature2, DAI);

      expect(await dai.balanceOf(account.address)).to.gt(
        daiBalanceBefore.add(minimumAmount),
      );
    });

    it('Should supply WETH and withdraw it', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 2n * 10n ** 18n;
      const minimumAmount = 1n * 10n ** 18n;

      const { signature, permit } = await sign(
        {
          amount,
          token: WETH,
        },
        contract.address,
      );

      const aWethBalanceBefore = await aWeth.balanceOf(
        account.address,
      );

      await contract.supply(permit, signature);

      const aWethBalanceAfter = await aWeth.balanceOf(
        account.address,
      );

      expect(aWethBalanceAfter).to.gt(aWethBalanceBefore);

      const { signature: signature2, permit: permit2 } = await sign(
        {
          amount: aWethBalanceAfter,
          token: A_WETH,
        },
        contract.address,
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);

      await contract.withdraw(permit2, signature2, WETH);

      expect(await weth.balanceOf(account.address)).to.gt(
        wethBalanceBefore.add(minimumAmount),
      );
    });

    it('Should supply ETH directly and withdraw ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 18n;
      const minimumAmount = 9n * 10n ** 18n;

      const aWethBalanceBefore = await aWeth.balanceOf(
        account.address,
      );

      await contract.supplyETH(fee, {
        value: amount - fee,
      });

      const aWethBalanceAfter = await aWeth.balanceOf(
        account.address,
      );

      expect(aWethBalanceAfter).to.gte(
        aWethBalanceBefore.add(minimumAmount),
      );

      const balanceBefore = await account.getBalance();

      const { signature, permit } = await sign(
        {
          amount: aWethBalanceAfter,
          token: A_WETH,
        },
        contract.address,
      );

      await contract.withdrawETH(permit, signature);

      expect(await account.getBalance()).to.gt(
        balanceBefore.add(minimumAmount),
      );
    });

    it('Should supply ETH directly and withdraw WETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 18n;
      const minimumAmount = 9n * 10n ** 18n;

      const aWethBalanceBefore = await aWeth.balanceOf(
        account.address,
      );

      await contract.supplyETH(fee, {
        value: amount - fee,
      });

      const aWethBalanceAfter = await aWeth.balanceOf(
        account.address,
      );

      expect(aWethBalanceAfter).to.gte(
        aWethBalanceBefore.add(minimumAmount),
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const { permit, signature } = await sign(
        {
          token: A_WETH,
          amount: aWethBalanceAfter,
        },
        contract.address,
      );

      await contract.withdraw(permit, signature, WETH);

      expect(await weth.balanceOf(account.address)).to.gt(
        wethBalanceBefore.add(minimumAmount),
      );
    });
  });

  describe('Admin', () => {
    it('Should change lending pool address', async () => {
      const { contract } = await loadFixture(deploy);

      const newLendingPoolAddress =
        '0xc6845a5c768bf8d7681249f8927877efda425baf';

      await contract.setNewAddresses(
        newLendingPoolAddress,
        WETH_GATEWAY,
      );

      const currentOwner = await contract.lendingPool();

      expect(currentOwner).to.hexEqual(newLendingPoolAddress);
    });

    it('Should revert when trying to change lending pool address (not using owner)', async () => {
      const { contract } = await loadFixture(deploy);

      const newLendingPoolAddress =
        '0xc6845a5c768bf8d7681249f8927877efda425baf';

      await expect(
        contract
          .connect(otherAccount)
          .setNewAddresses(newLendingPoolAddress, WETH_GATEWAY),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should withdraw money', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await account.sendTransaction({
        to: contract.address,
        value: amount,
      });

      const balanceBefore = await account.getBalance();

      await contract.withdrawAdmin();

      expect(await account.getBalance()).to.gt(balanceBefore);
    });
  });
});
