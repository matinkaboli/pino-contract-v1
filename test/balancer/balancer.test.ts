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
import { impersonate, multiSigner, signer } from '../utils/helpers';

const ETH = '0x0000000000000000000000000000000000000000';
const AURA = '0xc0c293ce456ff0ed870add98a0828dd4d2903dbf';
const WSTETH = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0';
const VAULT_ADDRESS = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

describe('Balancer', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let weth: IWETH9;
  let aura: IERC20;
  let wstETH: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Balancer = await ethers.getContractFactory('Balancer');

    const contract = await Balancer.deploy(
      PERMIT2_ADDRESS,
      VAULT_ADDRESS,
      [USDC, USDT, WETH],
    );

    return {
      contract,
      sign: await signer(account),
      multiSign: await multiSigner(account),
    };
  };

  before(async () => {
    const whale = await impersonate(WHALE3POOL);
    [account] = await ethers.getSigners();

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    weth = await ethers.getContractAt('IWETH9', WETH);
    aura = await ethers.getContractAt('IERC20', AURA);
    wstETH = await ethers.getContractAt('IERC20', WSTETH);

    const amount = 5000n * 10n ** 6n;
    const ethAmount = 3n * 10n ** 18n;
    const daiAmount = 5000n * 10n ** 18n;

    await usdc.connect(whale).transfer(account.address, amount);
    await usdt.connect(whale).transfer(account.address, amount);
    await dai.connect(whale).transfer(account.address, daiAmount);
    await weth.deposit({
      value: ethAmount,
    });

    expect(await usdc.balanceOf(account.address)).to.gte(amount);
    expect(await usdt.balanceOf(account.address)).to.gte(amount);
    expect(await dai.balanceOf(account.address)).to.gte(daiAmount);
    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);

    await dai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy with 0 approved tokens', async () => {
      const Balancer = await ethers.getContractFactory('Balancer');

      await Balancer.deploy(PERMIT2_ADDRESS, VAULT_ADDRESS, []);
    });

    it('Should approve token after deployment', async () => {
      const { contract } = await loadFixture(deploy);

      await contract.approveToken(DAI);

      const allowance = await dai.allowance(
        contract.address,
        VAULT_ADDRESS,
      );

      expect(allowance).to.equal(ethers.constants.MaxUint256);
    });
  });

  describe('Joins', () => {
    it('Should join ETH_wstETH pool', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;
      const poolId =
        '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080';
      const maxAmountsIn = [0, amount];
      const BPT = '0x32296969ef14eb0c6d29669c550d4a0449130230';

      const parameterTypes = ['uint256', 'uint256[]', 'uint256'];
      const parameterValues = [1, maxAmountsIn, 0];
      const userData = ethers.utils.defaultAbiCoder.encode(
        parameterTypes,
        parameterValues,
      );

      const poolContract = await ethers.getContractAt('IERC20', BPT);

      const bptAmountBefore = await poolContract.balanceOf(
        account.address,
      );

      const params = {
        poolId,
        userData,
        assets: [WSTETH, ETH],
        maxAmountsIn,
        proxyFee: 0,
      };

      await contract.joinPoolETH(params, {
        value: amount,
      });

      const bptAmountAfter = await poolContract.balanceOf(
        account.address,
      );

      expect(bptAmountAfter).to.gt(bptAmountBefore);

      await contract.approveToken(BPT);
      await poolContract.approve(
        PERMIT2_ADDRESS,
        constants.MaxUint256,
      );

      const { permit: permit1, signature: signature1 } = await sign(
        {
          token: BPT,
          amount: bptAmountAfter,
        },
        contract.address,
      );

      const parameterTypes1 = ['uint256', 'uint256', 'uint256'];
      const parameterValues1 = [0, bptAmountAfter, 0];
      const userData1 = ethers.utils.defaultAbiCoder.encode(
        parameterTypes1,
        parameterValues1,
      );

      const wstETHBalanaceBefore = await wstETH.balanceOf(
        account.address,
      );

      const exitParams = {
        poolId,
        assets: [WSTETH, ETH],
        minAmountsOut: [0, 0],
        userData: userData1,
        permit: permit1,
        signature: signature1,
      };

      await contract.exitPool(exitParams);

      const wstETHBalanaceAfter = await wstETH.balanceOf(
        account.address,
      );

      expect(wstETHBalanaceAfter).to.gt(wstETHBalanaceBefore);
    });

    it('Should join USDC_WETH Stable pool and exit pool', async () => {
      const { contract, sign, multiSign } = await loadFixture(deploy);

      const amount0 = 1000n * 10n ** 6n;
      const amount1 = 1n * 10n ** 18n;

      const poolId =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount0,
          },
          {
            token: WETH,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const parameterTypes = ['uint256', 'uint256[]', 'uint256'];
      const parameterValues = [1, [amount0, amount1], 0];
      const userData = ethers.utils.defaultAbiCoder.encode(
        parameterTypes,
        parameterValues,
      );

      const BPT = '0x96646936b91d6B9D7D0c47C496AfBF3D6ec7B6f8';

      const poolContract = await ethers.getContractAt('IERC20', BPT);

      const bptAmountBefore = await poolContract.balanceOf(
        account.address,
      );

      const params = {
        poolId,
        userData,
        assets: [USDC, WETH],
        maxAmountsIn: [amount0, amount1],
        proxyFee: 0,
        permit,
        signature,
      };

      await contract.joinPool(params);

      const bptAmountAfter = await poolContract.balanceOf(
        account.address,
      );

      expect(bptAmountAfter).to.gt(bptAmountBefore);

      await contract.approveToken(BPT);
      await poolContract.approve(
        PERMIT2_ADDRESS,
        constants.MaxUint256,
      );

      const { permit: permit1, signature: signature1 } = await sign(
        {
          token: BPT,
          amount: bptAmountAfter,
        },
        contract.address,
      );

      const parameterTypes1 = ['uint256', 'uint256', 'uint256'];
      const parameterValues1 = [0, bptAmountAfter, 0];
      const userData1 = ethers.utils.defaultAbiCoder.encode(
        parameterTypes1,
        parameterValues1,
      );

      const usdcBalanaceBefore = await usdc.balanceOf(
        account.address,
      );

      const exitParams = {
        poolId,
        assets: [USDC, WETH],
        minAmountsOut: [0, 0],
        userData: userData1,
        permit: permit1,
        signature: signature1,
      };

      await contract.exitPool(exitParams);

      const usdcBalanaceAfter = await usdc.balanceOf(account.address);

      expect(usdcBalanaceAfter).to.gt(usdcBalanaceBefore);
    });

    it('Should join USDC_WETH Stable pool using JoinPool function', async () => {
      const { contract, sign, multiSign } = await loadFixture(deploy);

      const amount0 = 1000n * 10n ** 6n;
      const amount1 = 1n * 10n ** 18n;

      const poolId =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount0,
          },
        ],
        contract.address,
      );

      const parameterTypes = ['uint256', 'uint256[]', 'uint256'];
      const parameterValues = [1, [amount0, amount1], 0];
      const userData = ethers.utils.defaultAbiCoder.encode(
        parameterTypes,
        parameterValues,
      );

      const BPT = '0x96646936b91d6B9D7D0c47C496AfBF3D6ec7B6f8';

      const poolContract = await ethers.getContractAt('IERC20', BPT);

      const bptAmountBefore = await poolContract.balanceOf(
        account.address,
      );

      const params = {
        poolId,
        userData,
        assets: [USDC, ETH],
        maxAmountsIn: [amount0, amount1],
        proxyFee: 0,
        permit,
        signature,
      };

      await contract.joinPool(params, {
        value: amount1,
      });

      const bptAmountAfter = await poolContract.balanceOf(
        account.address,
      );

      expect(bptAmountAfter).to.gt(bptAmountBefore);
    });
  });

  describe('Swaps', () => {
    it('Should swap USDC to WETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const poolId =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount: 2000n * 10n ** 6n,
        },
        contract.address,
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);

      await contract.swap(
        poolId,
        WETH,
        0,
        ethers.utils.toUtf8Bytes(''),
        permit,
        signature,
      );

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);
    });

    it('Should swap USDC to ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const poolId =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount: 2000n * 10n ** 6n,
        },
        contract.address,
      );

      const accountBalanceBefore = await account.getBalance();

      await contract.swap(
        poolId,
        ETH,
        0,
        ethers.utils.toUtf8Bytes(''),
        permit,
        signature,
      );

      const accountBalanceAfter = await account.getBalance();

      expect(accountBalanceAfter).to.gt(accountBalanceBefore);
    });

    it('Should swap ETH to wstETH', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;
      const poolId =
        '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080';

      const wstBalanceBefore = await wstETH.balanceOf(
        account.address,
      );

      await contract.swapETH(
        poolId,
        WSTETH,
        0,
        ethers.utils.toUtf8Bytes(''),
        0,
        {
          value: amount,
        },
      );

      const wstBalanceAfter = await wstETH.balanceOf(account.address);

      expect(wstBalanceAfter).to.gt(wstBalanceBefore);
    });
  });
});
