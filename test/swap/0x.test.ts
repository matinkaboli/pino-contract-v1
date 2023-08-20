import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import qs from 'qs';
import {
  DAI,
  USDC,
  USDT,
  WETH,
  LUSD,
  WHALE3POOL,
} from '../utils/addresses';
import { IERC20, IWETH9 } from '../../typechain-types';
import { impersonate, signer } from '../utils/helpers';

const API_QUOTE_URL = 'https://api.0x.org/swap/v1/quote';
const OneInchV5 = '0x1111111254EEB25477B68fb85Ed929f73A960582';
const Paraswap = '0x55b916ce078ea594c10a874ba67ecc3d62e29822';
const ZERO_X_ADDRESS = '0xdef1c0ded9bec7f1a1670819833240f027b25eff';

describe('0x', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let lusd: IERC20;
  let weth: IWETH9;
  let account: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const deploy = async () => {
    const SwapAgg = await ethers.getContractFactory(
      'SwapAggregators',
    );

    const contract = await SwapAgg.deploy(
      PERMIT2_ADDRESS,
      WETH,
      OneInchV5,
      Paraswap,
    );

    return { contract, sign: await signer(account) };
  };

  before(async () => {
    const whale = await impersonate(WHALE3POOL);
    [account, otherAccount] = await ethers.getSigners();

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    weth = await ethers.getContractAt('IWETH9', WETH);
    lusd = await ethers.getContractAt('IERC20', LUSD);

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
    await lusd.approve(PERMIT2_ADDRESS, constants.MaxUint256);
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
      );
    });
  });

  describe('Swap', () => {
    it('Should swap USDC for DAI', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 500n * 10n ** 6n;

      const params = qs.stringify({
        sellToken: 'USDC',
        buyToken: 'DAI',
        sellAmount: amount.toString(),
      });

      const quote = await fetch(`${API_QUOTE_URL}?${params}`).then(
        (y) => y.json(),
      );

      await contract.approveToken(USDC, [ZERO_X_ADDRESS]);
      const { signature, permit } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx = await contract.populateTransaction.swap0x(
        quote.to,
        quote.data,
      );

      const sweepTx = await contract.populateTransaction.sweepToken(
        DAI,
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        swapTx.data,
        sweepTx.data,
      ]);

      expect(await dai.balanceOf(account.address)).to.gt(
        daiBalanceBefore,
      );
    });

    it('Should swap USDT for WETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 500n * 10n ** 6n;

      const params = qs.stringify({
        sellToken: 'USDT',
        buyToken: 'WETH',
        sellAmount: amount.toString(),
      });

      const quote = await fetch(`${API_QUOTE_URL}?${params}`).then(
        (y) => y.json(),
      );

      const { signature, permit } = await sign(
        {
          amount,
          token: USDT,
        },
        contract.address,
      );

      const daiBalanceBefore = await weth.balanceOf(account.address);

      const approveTx =
        await contract.populateTransaction.approveToken(USDT, [
          ZERO_X_ADDRESS,
        ]);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx = await contract.populateTransaction.swap0x(
        quote.to,
        quote.data,
      );

      const sweepTx = await contract.populateTransaction.sweepToken(
        WETH,
        account.address,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        swapTx.data,
        sweepTx.data,
      ]);

      expect(await weth.balanceOf(account.address)).to.gt(
        daiBalanceBefore,
      );
    });

    it('Should swap WETH for USDC', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 17n;

      const params = qs.stringify({
        sellToken: 'WETH',
        buyToken: 'USDC',
        sellAmount: amount.toString(),
      });

      const quote = await fetch(`${API_QUOTE_URL}?${params}`).then(
        (y) => y.json(),
      );

      await contract.approveToken(WETH, [quote.allowanceTarget]);

      const { signature, permit } = await sign(
        {
          amount,
          token: WETH,
        },
        contract.address,
      );

      const daiBalanceBefore = await usdc.balanceOf(account.address);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx = await contract.populateTransaction.swap0x(
        quote.to,
        quote.data,
      );

      const sweepTx = await contract.populateTransaction.sweepToken(
        USDC,
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        swapTx.data,
        sweepTx.data,
      ]);

      expect(await usdc.balanceOf(account.address)).to.gt(
        daiBalanceBefore,
      );
    });

    it('Should swap ETH for LUSD', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const params = qs.stringify({
        sellToken: 'ETH',
        buyToken: LUSD,
        sellAmount: amount.toString(),
      });

      const quote = await fetch(`${API_QUOTE_URL}?${params}`).then(
        (y) => y.json(),
      );

      const lusdBalanceBefore = await lusd.balanceOf(account.address);

      const wrapTx = await contract.populateTransaction.wrapETH(0);

      const swapTx = await contract.populateTransaction.swap0x(
        quote.to,
        quote.data,
      );

      const sweepTx = await contract.populateTransaction.sweepToken(
        LUSD,
        account.address,
      );

      await contract.multicall(
        [wrapTx.data, swapTx.data, sweepTx.data],
        {
          value: amount,
        },
      );

      expect(await lusd.balanceOf(account.address)).to.gt(
        lusdBalanceBefore,
      );
    });
  });

  describe('Admin', () => {
    it('Should change addresses', async () => {
      const { contract } = await loadFixture(deploy);

      const new1InchAddress =
        '0xc6845a5c768bf8d7681249f8927877efda425baf';

      await contract.setDexAddresses(new1InchAddress, Paraswap);

      const OneInchAddress = await contract.OInch();

      expect(OneInchAddress).to.hexEqual(new1InchAddress);
    });

    it('Should revert when trying to change addresses (not using owner)', async () => {
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

      await contract.withdrawAdmin(account.address);

      expect(await account.getBalance()).to.gt(balanceBefore);
    });
  });
});
