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
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;
      const poolId =
        '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080';
      const maxAmountsIn = [0, amount];

      const parameterTypes = ['uint256', 'uint256[]', 'uint256'];
      const parameterValues = [1, maxAmountsIn, 0];
      const userData = ethers.utils.defaultAbiCoder.encode(
        parameterTypes,
        parameterValues,
      );

      const poolContract = await ethers.getContractAt(
        'IERC20',
        '0x32296969ef14eb0c6d29669c550d4a0449130230',
      );

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

      expect(await poolContract.balanceOf(account.address)).to.gt(
        bptAmountBefore,
      );
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

      await contract.exitPool(
        poolId,
        [USDC, WETH],
        [0, 0],
        userData1,
        permit1,
        signature1,
      );

      const usdcBalanaceAfter = await usdc.balanceOf(account.address);

      expect(usdcBalanaceAfter).to.gt(usdcBalanaceBefore);
    });

    it('Should join Balancer Boosted Aave USD pool', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const poolId =
        '0xa13a9247ea42d743238089903570127dda72fe4400000000000000000000035d';

      const amount0 = 100n * 10n ** 6n;
      const amount1 = 100n * 10n ** 18n;

      const maxAmountsIn = [amount0, amount0, amount1];

      const parameterTypes = ['uint256', 'uint256[]', 'uint256'];
      const parameterValues = [1, maxAmountsIn, 0];
      const userData = ethers.utils.defaultAbiCoder.encode(
        parameterTypes,
        parameterValues,
      );

      const { permit, signature } = await multiSign(
        [
          {
            token: USDT,
            amount: amount0,
          },
          {
            token: USDC,
            amount: amount0,
          },
          {
            token: DAI,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const BB_A_USDT = '0x2F4eb100552ef93840d5aDC30560E5513DFfFACb';
      const BB_A_USDC = '0x82698aeCc9E28e9Bb27608Bd52cF57f704BD1B83';
      const BB_A_USD = '0xA13a9247ea42D743238089903570127DdA72fE44';
      const BB_A_DAI = '0xae37D54Ae477268B9997d4161B96b8200755935c';

      const params = {
        poolId,
        userData,
        assets: [BB_A_USDT, BB_A_USDC, BB_A_USD, BB_A_DAI],
        maxAmountsIn,
        proxyFee: 0,
        permit,
        signature,
      };

      await contract.joinPool(params);
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

    it('Should batch swap USDC > WETH > WSTETH', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount0 = 1000n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount0,
          },
        ],
        contract.address,
      );

      const swapSteps = [
        {
          poolId:
            '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063',
          assetInIndex: 0,
          assetOutIndex: 1,
          amount: amount0,
          userData: ethers.utils.toUtf8Bytes(''),
        },
        {
          poolId:
            '0x0b09dea16768f0799065c475be02919503cb2a3500020000000000000000001a',
          amount: 0,
          assetInIndex: 1,
          assetOutIndex: 2,
          userData: ethers.utils.toUtf8Bytes(''),
        },
        {
          poolId:
            '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080',
          assetInIndex: 2,
          assetOutIndex: 3,
          amount: 0,
          userData: ethers.utils.toUtf8Bytes(''),
        },
      ];

      const assets = [USDC, DAI, WETH, WSTETH];

      // const vault = await ethers.getContractAt(
      //   'IVault',
      //   VAULT_ADDRESS,
      // );
      // const funds = {
      //   sender: account.address,
      //   fromInternalBalance: false,
      //   recipient: account.address,
      //   toInternalBalance: false,
      // };
      //
      // const limits = await vault.callStatic.queryBatchSwap(
      //   0,
      //   swapSteps,
      //   assets,
      //   funds,
      // );
      //
      // console.log('LIMITS:');
      // console.log(limits);
      // const rx = await limits.wait();
      // console.log(rx);

      const limitsParams = [
        '1000000000',
        '0',
        '0',
        '-478509738907085518',
      ];

      const wstBalanceBefore = await wstETH.balanceOf(
        account.address,
      );

      const params = {
        swaps: swapSteps,
        assets,
        limits: limitsParams,
        permit,
        signature,
      };

      await contract.batchSwap(params);

      const wstBalanceAfter = await wstETH.balanceOf(account.address);

      expect(wstBalanceAfter).to.gt(wstBalanceBefore);
    });

    it('Should batch swap dai>BBUSD', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount0 = 100n * 10n ** 18n;

      const bbDAI =
        '0xae37d54ae477268b9997d4161b96b8200755935c000000000000000000000337';

      const vault = await ethers.getContractAt(
        'IVault',
        VAULT_ADDRESS,
      );
      const funds = {
        sender: account.address,
        fromInternalBalance: false,
        recipient: account.address,
        toInternalBalance: false,
      };

      const swapSteps = [
        {
          poolId:
            '0xae37d54ae477268b9997d4161b96b8200755935c000000000000000000000337',
          assetInIndex: 0,
          assetOutIndex: 1,
          amount: amount0,
          userData: ethers.utils.toUtf8Bytes(''),
        },
      ];

      const assets = [
        DAI,
        '0xae37D54Ae477268B9997d4161B96b8200755935c',
      ];

      const limits = await vault.callStatic.queryBatchSwap(
        0,
        swapSteps,
        assets,
        funds,
      );

      console.log('LIMITS:');
      console.log(limits);
    });
  });
});
