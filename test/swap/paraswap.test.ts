import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  DAI,
  ETH,
  USDC,
  USDT,
  WETH,
  WHALE3POOL,
} from '../utils/addresses';
import paraswapCall from '../utils/paraswap-call';
import { IERC20, IWETH9 } from '../../typechain-types';
import { impersonate, signer } from '../utils/helpers';

const ZERO_X_ADDRESS = '0xdef1c0ded9bec7f1a1670819833240f027b25eff';
const ONE_INCH_V5_ADDRESS =
  '0x1111111254EEB25477B68fb85Ed929f73A960582';
const PARASWAP_ADDRESS = '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57';
const PARASWAP_ALLOWANCE_ADDRESS =
  '0x216b4b4ba9f3e719726886d34a177484278bfcae';

describe('Paraswap', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let weth: IWETH9;
  let account: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const deploy = async () => {
    const Swap = await ethers.getContractFactory('Swap');

    const contract = await Swap.deploy(
      PERMIT2_ADDRESS,
      WETH,
      ZERO_X_ADDRESS,
      ONE_INCH_V5_ADDRESS,
      PARASWAP_ADDRESS,
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
      const Swap = await ethers.getContractFactory('Swap');

      await Swap.deploy(
        PERMIT2_ADDRESS,
        WETH,
        ZERO_X_ADDRESS,
        ONE_INCH_V5_ADDRESS,
        PARASWAP_ADDRESS,
      );
    });
  });

  describe('Swap', () => {
    it('Should swap USDC for DAI', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const token = USDC;
      const amount = 100n * 10n ** 6n;

      const params = {
        srcToken: USDC,
        srcDecimals: 6,
        destToken: DAI,
        destDecimals: 18,
        amount: amount.toString(),
        receiver: account.address,
        userAddress: contract.address,
      };

      const result = await paraswapCall(params);

      const { signature, permit } = await sign(
        {
          amount,
          token,
        },
        contract.address,
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);
      const daiBalanceBefore2 = await dai.balanceOf(contract.address);

      const approveTx =
        await contract.populateTransaction.approveToken(USDC, [
          PARASWAP_ALLOWANCE_ADDRESS,
        ]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx = await contract.populateTransaction.swapParaswap(
        result,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        swapTx.data,
      ]);

      const daiBalanceBefore3 = await dai.balanceOf(contract.address);

      console.log(daiBalanceBefore2, daiBalanceBefore3);
      console.log(daiBalanceBefore);
      console.log(await dai.balanceOf(account.address));

      expect(await dai.balanceOf(account.address)).to.gt(
        daiBalanceBefore,
      );
    });

    it('Should swap ETH for USDT', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 300n;
      const amount = 1n * 10n ** 17n;

      const usdtBalanceBefore = await usdt.balanceOf(account.address);

      const params = {
        srcToken: WETH,
        srcDecimals: 18,
        destToken: USDT,
        destDecimals: 6,
        amount: amount.toString(),
        receiver: account.address,
        userAddress: contract.address,
      };

      const result = await paraswapCall(params);

      console.log(result);

      const approveTx =
        await contract.populateTransaction.approveToken(WETH, [
          PARASWAP_ALLOWANCE_ADDRESS,
        ]);
      const wrapTx = await contract.populateTransaction.wrapETH(
        proxyFee,
      );
      const swapTx = await contract.populateTransaction.swapParaswap(
        result,
      );

      await contract.multicall(
        [approveTx.data, wrapTx.data, swapTx.data],
        {
          value: amount + proxyFee,
        },
      );

      expect(await usdt.balanceOf(account.address)).to.gt(
        usdtBalanceBefore,
      );
    });
  });

  describe('Admin', () => {
    it('Should change paraswap address', async () => {
      const { contract } = await loadFixture(deploy);

      const new1InchAddress =
        '0xc6845a5c768bf8d7681249f8927877efda425baf';

      await contract.setNewAddresses(
        new1InchAddress,
        PARASWAP_ADDRESS,
        ZERO_X_ADDRESS,
      );

      const OneInchAddress = await contract.OneInch();

      expect(OneInchAddress).to.hexEqual(new1InchAddress);
    });

    it('Should revert when trying to change 1Inch address (not using owner)', async () => {
      const { contract } = await loadFixture(deploy);

      const new1InchAddress =
        '0xc6845a5c768bf8d7681249f8927877efda425baf';

      await expect(
        contract
          .connect(otherAccount)
          .setNewAddresses(
            ZERO_X_ADDRESS,
            new1InchAddress,
            PARASWAP_ADDRESS,
          ),
      ).to.be.revertedWithCustomError(
        contract,
        'OwnableUnauthorizedAccount',
      );
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
