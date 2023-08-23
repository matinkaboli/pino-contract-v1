import { expect } from 'chai';
import { ethers } from 'hardhat';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  USDC,
  USDT,
  LUSD,
  DAI,
  WETH,
  WHALE3POOL,
} from '../utils/addresses';
import { IERC20, IWETH9 } from '../../typechain-types';
import { impersonate, multiSigner, signer } from '../utils/helpers';
import {
  fromReadableAmount,
  uniswapRouteInput,
  uniswapRouteOutput,
} from '../utils/uniswap-order-route';
import {
  DAI_TOKEN,
  ETH_TOKEN,
  LUSD_TOKEN,
  WETH_TOKEN,
} from '../utils/uniswap-tokens';

const { constants } = ethers;
const SWAP_ROUTER_2 = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';

describe('Uniswap - Swap Router 2', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let lusd: IERC20;
  let weth: IWETH9;
  let account: SignerWithAddress;

  const deploy = async () => {
    const ISwap = await ethers.getContractFactory('Swap');

    const contract = await ISwap.deploy(
      PERMIT2_ADDRESS,
      WETH,
      SWAP_ROUTER_2, // 0x
      SWAP_ROUTER_2, // curve
      SWAP_ROUTER_2, // 1inch
      SWAP_ROUTER_2, // uniswap
      SWAP_ROUTER_2, // paraswap
      SWAP_ROUTER_2, // balancer
    );

    await contract.approveToken(DAI, [SWAP_ROUTER_2]);
    await contract.approveToken(USDC, [SWAP_ROUTER_2]);
    await contract.approveToken(USDT, [SWAP_ROUTER_2]);
    await contract.approveToken(LUSD, [SWAP_ROUTER_2]);

    return {
      contract,
      sign: await signer(account),
      multiSign: await multiSigner(account),
    };
  };

  before(async () => {
    [account] = await ethers.getSigners();
    const whale = await impersonate(WHALE3POOL);

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    lusd = await ethers.getContractAt('IERC20', LUSD);
    weth = await ethers.getContractAt('IWETH9', WETH);

    const amount0 = 5000n * 10n ** 6n;
    const amount1 = 4000n * 10n ** 18n;

    await weth.deposit({ value: amount1 });
    await dai.connect(whale).transfer(account.address, amount1);
    await usdc.connect(whale).transfer(account.address, amount0);
    await usdt.connect(whale).transfer(account.address, amount0);

    expect(await dai.balanceOf(account.address)).to.gte(amount1);
    expect(await weth.balanceOf(account.address)).to.gte(amount1);
    expect(await usdc.balanceOf(account.address)).to.gte(amount0);
    expect(await usdt.balanceOf(account.address)).to.gte(amount0);

    await dai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await lusd.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy without any erorrs', async () => {
      const ISwap = await ethers.getContractFactory('Swap');

      await ISwap.deploy(
        PERMIT2_ADDRESS,
        WETH,
        SWAP_ROUTER_2, // 0x
        SWAP_ROUTER_2, // curve
        SWAP_ROUTER_2, // 1inch
        SWAP_ROUTER_2, // uniswap
        SWAP_ROUTER_2, // paraswap
        SWAP_ROUTER_2, // balancer
      );
    });
  });

  describe('Swap multihop', () => {
    it('Should swap WETH > LUSD exact input', async () => {
      const { sign, contract } = await loadFixture(deploy);

      const token = WETH;
      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          token,
          amount,
        },
        contract.address,
      );

      const { calldata } = await uniswapRouteInput(
        account.address,
        fromReadableAmount(1, 18),
        WETH_TOKEN,
        LUSD_TOKEN,
      );

      console.log(calldata);

      if (!calldata) {
        throw Error('Could not find a path');
      }

      const lusdBalanceBefore = await lusd.balanceOf(account.address);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx = await contract.populateTransaction.swapUniswap(
        calldata,
      );

      await contract.multicall([permitTx.data, swapTx.data]);

      const lusdBalanceAfter = await lusd.balanceOf(account.address);

      expect(lusdBalanceAfter).to.gt(lusdBalanceBefore);
    });

    it('Should swap DAI > USDC > WETH exact input', async () => {
      const { sign, contract } = await loadFixture(deploy);

      const amount = 500n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          amount,
          token: DAI,
        },
        contract.address,
      );

      const { calldata } = await uniswapRouteInput(
        account.address,
        fromReadableAmount(500, 18),
        DAI_TOKEN,
        WETH_TOKEN,
      );

      if (!calldata) {
        throw Error('Could not find a path');
      }

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx = await contract.populateTransaction.swapUniswap(
        calldata,
      );

      await contract.multicall([permitTx.data, swapTx.data]);

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);
    });

    it('Should swap ETH > LUSD exact input', async () => {
      const { sign, contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { calldata } = await uniswapRouteInput(
        account.address,
        fromReadableAmount(1, 18),
        WETH_TOKEN,
        LUSD_TOKEN,
      );

      if (!calldata) {
        throw Error('Could not find a path');
      }

      const lusdBalanceBefore = await lusd.balanceOf(account.address);

      const wrapTx = await contract.populateTransaction.wrapETH(0);

      const swapTx = await contract.populateTransaction.swapUniswap(
        calldata,
      );

      await contract.multicall([wrapTx.data, swapTx.data], {
        value: amount,
      });

      const lusdBalanceAfter = await lusd.balanceOf(account.address);

      expect(lusdBalanceAfter).to.gt(lusdBalanceBefore);
    });

    it('Should swap DAI > USDC > WETH exact output', async () => {
      const { sign, contract } = await loadFixture(deploy);

      const amount = 500n * 10n ** 18n;
      const amountOut = 1n * 10n ** 17n;

      const { permit, signature } = await sign(
        {
          amount,
          token: DAI,
        },
        contract.address,
      );

      const { calldata } = await uniswapRouteOutput(
        account.address,
        fromReadableAmount(1, 17),
        DAI_TOKEN,
        WETH_TOKEN,
      );

      if (!calldata) {
        throw Error('Could not find a path');
      }

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx = await contract.populateTransaction.swapUniswap(
        calldata,
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

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);
    });

    it('Should swap DAI > USDC > ETH exact input', async () => {
      const { sign, contract } = await loadFixture(deploy);

      const amount = 500n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          amount,
          token: DAI,
        },
        contract.address,
      );

      const { calldata } = await uniswapRouteInput(
        account.address,
        fromReadableAmount(500, 18),
        DAI_TOKEN,
        ETH_TOKEN,
      );

      if (!calldata) {
        throw Error('Could not find a path');
      }

      const ethBalanceBefore = await account.getBalance();

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx = await contract.populateTransaction.swapUniswap(
        calldata,
      );

      await contract.multicall([permitTx.data, swapTx.data]);

      const ethBalanceAfter = await account.getBalance();

      expect(ethBalanceAfter).to.gt(ethBalanceBefore);
    });

    it('Should swap ETH > USDC > DAI exact output ETH', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;
      const amountOut = 1000n * 10n ** 18n;

      const { calldata } = await uniswapRouteOutput(
        account.address,
        fromReadableAmount(1000, 18),
        WETH_TOKEN,
        DAI_TOKEN,
      );

      if (!calldata) {
        throw Error('Could not find a path');
      }

      const daiBalanceBefore = await dai.balanceOf(account.address);

      const wrapTx = await contract.populateTransaction.wrapETH(0);
      const swapTx = await contract.populateTransaction.swapUniswap(
        calldata,
      );
      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      await contract.multicall(
        [wrapTx.data, swapTx.data, unwrapTx.data],
        {
          value: amount,
        },
      );

      const daiBalanceAfter = await dai.balanceOf(account.address);

      expect(daiBalanceAfter).to.gt(daiBalanceBefore);
    });

    it('Should swap ETH > USDC > DAI exact input ETH', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { calldata } = await uniswapRouteInput(
        account.address,
        fromReadableAmount(1, 18),
        WETH_TOKEN,
        DAI_TOKEN,
      );

      if (!calldata) {
        throw Error('Could not find a path');
      }

      const daiBalanceBefore = await dai.balanceOf(account.address);

      const wrapTx = await contract.populateTransaction.wrapETH(0);

      const swapTx = await contract.populateTransaction.swapUniswap(
        calldata,
      );

      await contract.multicall([wrapTx.data, swapTx.data], {
        value: amount,
      });

      const daiBalanceAfter = await dai.balanceOf(account.address);

      expect(daiBalanceAfter).to.gt(daiBalanceBefore);
    });
  });
});
