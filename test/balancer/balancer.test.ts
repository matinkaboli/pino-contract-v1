import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants, ContractFactory } from 'ethers';
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
const WSTETH = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0';
const VAULT_ADDRESS = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

describe('Balancer', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let weth: IWETH9;
  let wstETH: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Balancer = await ethers.getContractFactory('Balancer');

    const contract = await Balancer.deploy(
      PERMIT2_ADDRESS,
      WETH,
      VAULT_ADDRESS,
    );

    return {
      contract,
      sign: await signer(account),
      multiSign: await multiSigner(account),
    };
  };

  const getLimits = async (swapSteps, assets) => {
    const vault = await ethers.getContractAt('IVault', VAULT_ADDRESS);

    const funds = {
      sender: account.address,
      fromInternalBalance: false,
      recipient: account.address,
      toInternalBalance: false,
    };

    const limits = await vault.callStatic.queryBatchSwap(
      0,
      swapSteps,
      assets,
      funds,
    );

    return limits;
  };

  before(async () => {
    const whale = await impersonate(WHALE3POOL);
    [account] = await ethers.getSigners();

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    weth = await ethers.getContractAt('IWETH9', WETH);
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
    await wstETH.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy with 0 approved tokens', async () => {
      const Balancer = await ethers.getContractFactory('Balancer');

      await Balancer.deploy(PERMIT2_ADDRESS, WETH, VAULT_ADDRESS);
    });

    it('Should approve token after deployment', async () => {
      const { contract } = await loadFixture(deploy);

      await contract.approveToken(DAI, [VAULT_ADDRESS]);

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
        assets: [WSTETH, WETH],
        maxAmountsIn,
      };

      const wrapTx = await contract.populateTransaction.wrapETH(0);

      const joinPoolTx = await contract.populateTransaction.joinPool(
        params,
      );

      await contract.multicall([wrapTx.data, joinPoolTx.data], {
        value: amount,
      });

      const bptAmountAfter = await poolContract.balanceOf(
        account.address,
      );

      expect(bptAmountAfter).to.gt(bptAmountBefore);

      await contract.approveToken(BPT, [VAULT_ADDRESS]);

      await poolContract.approve(
        PERMIT2_ADDRESS,
        constants.MaxUint256,
      );

      const { permit, signature } = await sign(
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
        userData: userData1,
        assets: [WSTETH, ETH],
        minAmountsOut: [0, 0],
      };

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const exitPoolTx = await contract.populateTransaction.exitPool(
        exitParams,
      );

      await contract.multicall([permitTx.data, exitPoolTx.data]);

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
      };

      const approveTx =
        await contract.populateTransaction.approveToken(USDC, [
          VAULT_ADDRESS,
        ]);

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const joinPoolTx = await contract.populateTransaction.joinPool(
        params,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        joinPoolTx.data,
      ]);

      const bptAmountAfter = await poolContract.balanceOf(
        account.address,
      );

      expect(bptAmountAfter).to.gt(bptAmountBefore);

      await poolContract.approve(
        PERMIT2_ADDRESS,
        constants.MaxUint256,
      );

      const { permit: permit1, signature: signature1 } = await sign(
        {
          token: BPT,
          amount: bptAmountAfter.toString(),
        },
        contract.address,
      );

      const parameterTypes1 = ['uint256', 'uint256', 'uint256'];
      const parameterValues1 = [0, bptAmountAfter.toString(), 0];
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
      };

      const approveTx2 =
        await contract.populateTransaction.approveToken(BPT, [
          VAULT_ADDRESS,
        ]);

      const permitTx2 =
        await contract.populateTransaction.permitTransferFrom(
          permit1,
          signature1,
        );

      const exitPoolTx = await contract.populateTransaction.exitPool(
        exitParams,
      );

      await contract.multicall([
        approveTx2.data,
        permitTx2.data,
        exitPoolTx.data,
      ]);

      const usdcBalanaceAfter = await usdc.balanceOf(account.address);

      expect(usdcBalanaceAfter).to.gt(usdcBalanaceBefore);
    });

    it('Should join USDC_WETH Stable pool using JoinPool function', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount0 = 1000n * 10n ** 6n;
      const amount1 = 1n * 10n ** 18n;

      const poolId =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount: amount0,
        },
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
      };

      const wrapTx = await contract.populateTransaction.wrapETH(0);

      await contract.approveToken(USDC, [VAULT_ADDRESS]);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const joinPoolTx = await contract.populateTransaction.joinPool(
        params,
      );

      await contract.multicall(
        [wrapTx.data, permitTx.data, joinPoolTx.data],
        {
          value: amount1,
        },
      );

      // const bptAmountAfter = await poolContract.balanceOf(
      //   account.address,
      // );
      //
      // expect(bptAmountAfter).to.gt(bptAmountBefore);
    });
  });

  describe('Swaps', () => {
    it('Should swap USDC to WETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 2000n * 10n ** 6n;

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

      const swapParams = {
        poolId,
        amount,
        kind: 0,
        limit: 0,
        assetIn: USDC,
        assetOut: WETH,
        userData: ethers.utils.toUtf8Bytes(''),
      };

      const approveTx =
        await contract.populateTransaction.approveToken(USDC, [
          VAULT_ADDRESS,
        ]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx = await contract.populateTransaction.swap(
        swapParams,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        swapTx.data,
      ]);

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);
    });

    it('Should swap USDC to ETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 2000n * 10n ** 6n;

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

      const swapParams = {
        poolId,
        amount,
        kind: 0,
        limit: 0,
        assetIn: USDC,
        assetOut: ETH,
        userData: ethers.utils.toUtf8Bytes(''),
      };

      const approveTx =
        await contract.populateTransaction.approveToken(USDC, [
          VAULT_ADDRESS,
        ]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx = await contract.populateTransaction.swap(
        swapParams,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        swapTx.data,
      ]);

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

      const swapParams = {
        poolId,
        amount,
        kind: 0,
        limit: 0,
        assetIn: WETH,
        assetOut: WSTETH,
        userData: ethers.utils.toUtf8Bytes(''),
      };

      const wrapTx = await contract.populateTransaction.wrapETH(0);
      const swapTx = await contract.populateTransaction.swap(
        swapParams,
      );

      await contract.multicall([wrapTx.data, swapTx.data], {
        value: amount,
      });

      const wstBalanceAfter = await wstETH.balanceOf(account.address);

      expect(wstBalanceAfter).to.gt(wstBalanceBefore);
    });

    it('Should batch swap USDC > WETH > WSTETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount0 = 1000n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount: amount0,
        },
        contract.address,
      );

      const swaps = [
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
      const limits = await getLimits(swaps, assets);

      const wstBalanceBefore = await wstETH.balanceOf(
        account.address,
      );

      const swapParams = {
        swaps,
        assets,
        limits,
        kind: 0,
      };

      const approveTx =
        await contract.populateTransaction.approveToken(USDC, [
          VAULT_ADDRESS,
        ]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx = await contract.populateTransaction.batchSwap(
        swapParams,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        swapTx.data,
      ]);

      const wstBalanceAfter = await wstETH.balanceOf(account.address);

      expect(wstBalanceAfter).to.gt(wstBalanceBefore);
    });

    it('Should batch swap DAI>WSTETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          token: DAI,
          amount,
        },
        contract.address,
      );

      const swaps = [
        {
          poolId:
            '0x0b09dea16768f0799065c475be02919503cb2a3500020000000000000000001a',
          amount,
          assetInIndex: 0,
          assetOutIndex: 1,
          userData: '0x',
        },
        {
          poolId:
            '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080',
          amount: '0',
          assetInIndex: 1,
          assetOutIndex: 2,
          userData: '0x',
        },
      ];
      const assets = [DAI, WETH, WSTETH];
      const limits = await getLimits(swaps, assets);

      const swapParams = {
        swaps,
        assets,
        limits,
        kind: 0,
      };

      const wstBalanceBefore = await wstETH.balanceOf(
        account.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(DAI, [
          VAULT_ADDRESS,
        ]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx = await contract.populateTransaction.batchSwap(
        swapParams,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        swapTx.data,
      ]);

      const wstBalanceAfter = await wstETH.balanceOf(account.address);

      expect(wstBalanceAfter).to.gt(wstBalanceBefore);
    });

    it('Should swap USDC to WETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 3000n * 10n ** 6n;
      const poolId =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';

      const swaps = [
        {
          poolId,
          amount,
          assetInIndex: 0,
          assetOutIndex: 1,
          userData: '0x',
        },
      ];

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount,
        },
        contract.address,
      );

      const assets = [USDC, WETH];
      const limits = await getLimits(swaps, assets);

      const swapParams = {
        swaps,
        assets,
        limits,
        kind: 0,
      };

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const approveTx =
        await contract.populateTransaction.approveToken(USDC, [
          VAULT_ADDRESS,
        ]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx = await contract.populateTransaction.batchSwap(
        swapParams,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        swapTx.data,
      ]);

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);
    });

    it('Should batch swap DAI>WSTETH and join weth-wseth pool', async () => {
      const { contract, sign, multiSign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 18n;

      await contract.approveToken(DAI, [VAULT_ADDRESS]);

      const { permit: permit1, signature: signature1 } = await sign(
        {
          token: DAI,
          amount,
        },
        contract.address,
      );

      const swaps = [
        {
          poolId:
            '0x0b09dea16768f0799065c475be02919503cb2a3500020000000000000000001a',
          amount,
          assetInIndex: 0,
          assetOutIndex: 1,
          userData: '0x',
        },
        {
          poolId:
            '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080',
          amount: '0',
          assetInIndex: 1,
          assetOutIndex: 2,
          userData: '0x',
        },
      ];
      const assets = [DAI, WETH, WSTETH];
      const limits = await getLimits(swaps, assets);

      const swapParams = {
        swaps,
        assets,
        limits,
        kind: 0,
      };

      await wstETH.approve(PERMIT2_ADDRESS, constants.MaxUint256);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit1,
          signature1,
        );
      const swapTx = await contract.populateTransaction.batchSwap(
        swapParams,
      );

      await contract.multicall([permitTx.data, swapTx.data]);
    });

    it('Should batch swap DAI>WSTETH and join weth-wseth pool through multicall', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 18n;

      const { permit: permit1, signature: signature1 } = await sign(
        {
          token: DAI,
          amount,
        },
        contract.address,
      );

      const swaps = [
        {
          poolId:
            '0x0b09dea16768f0799065c475be02919503cb2a3500020000000000000000001a',
          amount,
          assetInIndex: 0,
          assetOutIndex: 1,
          userData: '0x',
        },
        {
          poolId:
            '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080',
          amount: '0',
          assetInIndex: 1,
          assetOutIndex: 2,
          userData: '0x',
        },
      ];

      const assets = [DAI, WETH, WSTETH];
      const limits = await getLimits(swaps, assets);

      const swapParams = {
        swaps,
        assets,
        limits,
        kind: 0,
      };

      const amount2 = 3n * 10n ** 16n;

      const approveTx1 =
        await contract.populateTransaction.approveToken(DAI, [
          VAULT_ADDRESS,
        ]);
      const approveTx2 =
        await contract.populateTransaction.approveToken(WSTETH, [
          VAULT_ADDRESS,
        ]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit1,
          signature1,
        );
      const swapTx = await contract.populateTransaction.batchSwap(
        swapParams,
      );

      await contract.multicall([
        approveTx1.data,
        approveTx2.data,
        permitTx.data,
        swapTx.data,
      ]);

      const wstBalanceAfter = await wstETH.balanceOf(account.address);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: WSTETH,
          amount: wstBalanceAfter,
        },
        contract.address,
      );

      const poolId =
        '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080';
      const maxAmountsIn = [wstBalanceAfter, 0];

      const parameterTypes = ['uint256', 'uint256[]', 'uint256'];
      const parameterValues = [1, maxAmountsIn, 0];
      const userData = ethers.utils.defaultAbiCoder.encode(
        parameterTypes,
        parameterValues,
      );

      const joinParams = {
        poolId,
        userData,
        assets: [WSTETH, WETH],
        maxAmountsIn,
        proxyFee: 0,
      };

      const BPT = '0x32296969Ef14EB0c6d29669C550D4a0449130230';
      const poolContract = await ethers.getContractAt('IERC20', BPT);

      await poolContract.approve(
        PERMIT2_ADDRESS,
        constants.MaxUint256,
      );

      const permitTx2 =
        await contract.populateTransaction.permitTransferFrom(
          permit2,
          signature2,
        );

      const joinPoolTx = await contract.populateTransaction.joinPool(
        joinParams,
      );

      await contract.multicall([permitTx2.data, joinPoolTx.data]);
    });
  });
});
