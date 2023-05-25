import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  DAI,
  USDC,
  USDT,
  WETH,
  WHALE3POOL,
} from '../utils/addresses';
import { IERC20, IWETH9 } from '../../typechain-types';
import { impersonate, signer } from '../utils/helpers';
import { swapQuery } from '../utils/oneinch-call';

const OneInchV5 = '0x1111111254EEB25477B68fb85Ed929f73A960582';
const Paraswap = '0x55b916ce078ea594c10a874ba67ecc3d62e29822';

describe('1Inch', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let weth: IWETH9;
  let account: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const deploy = async () => {
    const OneInch = await ethers.getContractFactory(
      'SwapAggregators',
    );

    const contract = await OneInch.deploy(
      PERMIT2_ADDRESS,
      WETH,
      OneInchV5,
      Paraswap,
      [DAI, WETH],
    );

    await contract.approveToken(USDC, [OneInchV5]);
    await contract.approveToken(USDT, [OneInchV5]);

    return { contract, sign: await signer(account) };
  };

  before(async () => {
    const whale = await impersonate(WHALE3POOL);
    [account, otherAccount] = await ethers.getSigners();

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    weth = await ethers.getContractAt('IWETH9', WETH);

    const ethAmount = 3n * 10n ** 18n;
    const daiAmount = 5000n * 10n ** 18n;
    const usdcAmount = 1500n * 10n ** 6n;

    await usdc.connect(whale).transfer(account.address, usdcAmount);
    await usdt.connect(whale).transfer(account.address, usdcAmount);
    await dai.connect(whale).transfer(account.address, daiAmount);
    await weth.deposit({
      value: ethAmount,
    });

    expect(await dai.balanceOf(account.address)).to.gte(daiAmount);
    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);
    expect(await usdc.balanceOf(account.address)).to.gte(usdcAmount);
    expect(await usdt.balanceOf(account.address)).to.gte(usdcAmount);

    await dai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy with 0 tokens', async () => {
      const SwapAgg = await ethers.getContractFactory(
        'SwapAggregators',
      );

      await SwapAgg.deploy(
        PERMIT2_ADDRESS,
        WETH,
        OneInchV5,
        Paraswap,
        [],
      );
    });

    it('Should deploy with multiple tokens', async () => {
      const SwapAgg = await ethers.getContractFactory(
        'SwapAggregators',
      );

      await SwapAgg.deploy(
        PERMIT2_ADDRESS,
        WETH,
        OneInchV5,
        Paraswap,
        [DAI, USDC],
      );
    });
  });

  describe('Swap', () => {
    it('Should swap USDC for DAI', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 5n * 10n ** 6n;

      const swapParams = {
        fromTokenAddress: USDC,
        toTokenAddress: DAI,
        destReceiver: account.address,
        amount: amount.toString(),
        fromAddress: '0x1E7A7Bb102c04e601dE48a68A88Ec6EE59C372b9',
        slippage: 1,
        disableEstimate: false,
        allowPartialFill: false,
      };

      const query = await swapQuery(swapParams);

      const { signature, permit } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);

      await contract.swap1Inch(query.tx.data, 0, permit, signature);

      expect(await dai.balanceOf(account.address)).to.gt(
        daiBalanceBefore,
      );
    });

    it('Should swap ETH', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 17n;

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const swapParams = {
        fromTokenAddress:
          '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        toTokenAddress: USDC,
        destReceiver: account.address,
        amount: amount.toString(),
        fromAddress: '0x1E7A7Bb102c04e601dE48a68A88Ec6EE59C372b9',
        slippage: 1,
      };

      const query = await swapQuery(swapParams);

      await contract.swapETH1Inch(query.tx.data, 0, {
        value: amount,
      });

      expect(await usdc.balanceOf(account.address)).to.gt(
        usdcBalanceBefore,
      );
    });
  });

  describe('Admin', () => {
    it('Should change 1Inch address', async () => {
      const { contract } = await loadFixture(deploy);

      const new1InchAddress =
        '0xc6845a5c768bf8d7681249f8927877efda425baf';

      await contract.setDexAddresses(new1InchAddress, Paraswap);

      const OneInchAddress = await contract.OInch();

      expect(OneInchAddress).to.hexEqual(new1InchAddress);
    });

    it('Should revert when trying to change 1Inch address (not using owner)', async () => {
      const { contract } = await loadFixture(deploy);

      const new1InchAddress =
        '0xc6845a5c768bf8d7681249f8927877efda425baf';

      await expect(
        contract
          .connect(otherAccount)
          .setDexAddresses(new1InchAddress, Paraswap),
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
