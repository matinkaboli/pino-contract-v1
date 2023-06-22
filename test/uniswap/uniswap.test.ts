import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TradeType } from '@uniswap/sdk-core';
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
import { impersonate, multiSigner, signer } from '../utils/helpers';
import { IERC20, IWETH9 } from '../../typechain-types';
import {
  fromReadableAmount,
  uniswapOrderRoute,
} from '../utils/uniswap-order-route';
import { LUSD_TOKEN, WETH_TOKEN } from '../utils/uniswap-tokens';

const { constants } = ethers;
const NFPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

describe('Uniswap', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let lusd: IERC20;
  let weth: IWETH9;
  let account: SignerWithAddress;

  const deploy = async () => {
    const IUNISWAP = await ethers.getContractFactory('Uniswap');
    const encode = IUNISWAP.interface.encodeFunctionData;

    const contract = await IUNISWAP.deploy(
      PERMIT2_ADDRESS,
      WETH,
      SWAP_ROUTER,
      NFPM,
    );

    await contract.approveToken(DAI, [NFPM, SWAP_ROUTER]);
    await contract.approveToken(WETH, [NFPM, SWAP_ROUTER]);
    await contract.approveToken(USDC, [NFPM, SWAP_ROUTER]);
    await contract.approveToken(USDT, [NFPM, SWAP_ROUTER]);
    await contract.approveToken(LUSD, [NFPM, SWAP_ROUTER]);

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

  describe('Swap multihop', () => {
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

      const path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [DAI, 3000, USDC, 3000, WETH],
      );

      const swapParams = {
        path,
        amountIn: amount,
        amountOutMinimum: 0,
      };

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactInputMultihop(
          swapParams,
        );

      const sweepTx = await contract.populateTransaction.sweepToken(
        WETH,
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

    it.skip('Should swap ETH > LUSD using uniswap-smart-route', async () => {
      const { sign, contract } = await loadFixture(deploy);

      const amount = 3000n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          amount,
          token: WETH,
        },
        contract.address,
      );

      const pathBytes = await uniswapOrderRoute(
        account.address,
        fromReadableAmount(3000, 18),
        WETH_TOKEN,
        LUSD_TOKEN,
        TradeType.EXACT_INPUT,
      );

      if (!pathBytes) {
        throw Error('Could not find a path');
      }

      const lusdBalanceBefore = await lusd.balanceOf(account.address);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactInputMultihopMultiPool(
          pathBytes,
        );

      const sweepToken =
        await contract.populateTransaction.sweepToken(
          LUSD,
          account.address,
        );

      await contract.multicall([
        permitTx.data,
        swapTx.data,
        sweepToken.data,
      ]);

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

      const path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [WETH, 3000, USDC, 3000, DAI],
      );

      const swapParams = {
        path,
        amountOut,
        amountInMaximum: amount,
      };

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactOutputMultihop(
          swapParams,
        );

      const sweepTx = await contract.populateTransaction.sweepToken(
        WETH,
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

    it('Should swap DAI > USDC > WETH exact output and receive ETH instead', async () => {
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

      const path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [WETH, 3000, USDC, 3000, DAI],
      );

      const swapParams = {
        path,
        amountOut,
        amountInMaximum: amount,
      };

      const ethBalanceBefore = await account.getBalance();

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactOutputMultihop(
          swapParams,
        );

      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        swapTx.data,
        unwrapTx.data,
      ]);

      const ethBalanceAfter = await account.getBalance();

      expect(ethBalanceAfter).to.gt(ethBalanceBefore);
    });

    it('Should swap ETH > USDC > DAI exact output ETH', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;
      const amountOut = 1000n * 10n ** 18n;

      const path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [DAI, 100, USDC, 500, WETH],
      );

      const swapParams = {
        path,
        amountOut,
      };

      const daiBalanceBefore = await dai.balanceOf(account.address);

      await contract.swapExactOutputMultihopETH(swapParams, 0, {
        value: amount,
      });

      const daiBalanceAfter = await dai.balanceOf(account.address);

      expect(daiBalanceAfter).to.gt(daiBalanceBefore);
    });

    it('Should swap ETH > USDC > DAI exact input ETH', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;
      const proxyFee = 0n;

      const path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [WETH, 3000, USDC, 3000, DAI],
      );

      const swapParams = {
        path,
        amountIn: amount,
        amountOutMinimum: 0,
      };

      const daiBalanceBefore = await dai.balanceOf(account.address);

      const swapTx =
        await contract.populateTransaction.swapExactInputMultihopETH(
          swapParams,
          proxyFee,
        );

      const sweepTx = await contract.populateTransaction.sweepToken(
        DAI,
        account.address,
      );

      await contract.multicall([swapTx.data, sweepTx.data], {
        value: amount,
      });

      const daiBalanceAfter = await dai.balanceOf(account.address);

      expect(daiBalanceAfter).to.gt(daiBalanceBefore);
    });
  });

  describe('Swap ERC20 to ERC20', () => {
    it('Should swap USDC to DAI using (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 100n;
      const amount = 1000n * 10n ** 6n;
      const amountOutMinimum = 950n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const usdcBefore = await usdc.balanceOf(account.address);
      const daiBefore = await dai.balanceOf(account.address);

      const swapParams = {
        fee,
        tokenIn: USDC,
        tokenOut: DAI,
        amountIn: amount,
        amountOutMinimum,
        sqrtPriceLimitX96: 0,
      };

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactInputSingle(
          swapParams,
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

      expect(await usdc.balanceOf(account.address)).to.equal(
        usdcBefore.sub(amount),
      );

      expect(await dai.balanceOf(account.address)).to.gte(
        daiBefore.add(amountOutMinimum),
      );
    });

    it('Should swap USDC to USDT using (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 100n;
      const amount = 1000n * 10n ** 6n;
      const amountOutMinimum = 950n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const usdcBefore = await usdc.balanceOf(account.address);
      const usdtBefore = await usdt.balanceOf(account.address);

      const swapParams = {
        fee,
        tokenIn: USDC,
        tokenOut: USDT,
        amountIn: amount,
        amountOutMinimum,
        sqrtPriceLimitX96: 0,
      };

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactInputSingle(
          swapParams,
        );

      const sweepTx = await contract.populateTransaction.sweepToken(
        USDT,
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        swapTx.data,
        sweepTx.data,
      ]);

      expect(await usdc.balanceOf(account.address)).to.equal(
        usdcBefore.sub(amount),
      );

      expect(await usdt.balanceOf(account.address)).to.gte(
        usdtBefore.add(amountOutMinimum),
      );
    });

    it('Should swap DAI to USDC using (exact output)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 100n;
      const amount = 1000n * 10n ** 18n;
      const amountOut = 950n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          amount,
          token: DAI,
        },
        contract.address,
      );

      const usdcBefore = await usdc.balanceOf(account.address);

      const swapParams = {
        fee,
        tokenIn: DAI,
        tokenOut: USDC,
        amountInMaximum: amount,
        amountOut,
        sqrtPriceLimitX96: 0,
      };

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactOutputSingle(
          swapParams,
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

      expect(await usdc.balanceOf(account.address)).to.equal(
        usdcBefore.add(amountOut),
      );
    });

    it('Should swap USDT to USDC using (exact output)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 100n;
      const amount = 1000n * 10n ** 6n;
      const amountOut = 950n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDT,
        },
        contract.address,
      );

      const usdcBefore = await usdc.balanceOf(account.address);

      const swapParams = {
        fee,
        tokenIn: USDT,
        tokenOut: USDC,
        amountOut,
        amountInMaximum: amount,
        sqrtPriceLimitX96: 0,
      };

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactOutputSingle(
          swapParams,
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

      expect(await usdc.balanceOf(account.address)).to.gte(
        usdcBefore.add(amountOut),
      );
    });
  });

  describe('Swap ERC20 to ETH', () => {
    it('Should swap USDT to ETH using (exact output)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 100n;
      const amount = 2000n * 10n ** 6n;
      const amountOut = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDT,
        },
        contract.address,
      );

      const ethBalanceBefore = await account.getBalance();

      const swapParams = {
        fee,
        tokenIn: USDT,
        tokenOut: WETH,
        amountOut,
        amountInMaximum: amount,
        sqrtPriceLimitX96: 0,
      };

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactOutputSingle(
          swapParams,
        );

      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        swapTx.data,
        unwrapTx.data,
      ]);

      expect(await account.getBalance()).to.gte(ethBalanceBefore);
    });

    it('Should swap IERC20 for ETH (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 500n;
      const amountOutMinimum = 0;
      const amount = 2000n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const ethBalance = await account.getBalance();

      const swapParams = {
        fee,
        tokenIn: USDC,
        tokenOut: WETH,
        amountIn: amount,
        amountOutMinimum,
        sqrtPriceLimitX96: 0,
      };

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactInputSingle(
          swapParams,
        );

      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        swapTx.data,
        unwrapTx.data,
      ]);

      expect(await account.getBalance()).to.gte(ethBalance);
    });

    it('Should swap IERC20 for WETH (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 500n;
      const amountOutMinimum = 0;
      const amount = 2000n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const wethBalance = await weth.balanceOf(account.address);

      const swapParams = {
        fee,
        tokenIn: USDC,
        tokenOut: WETH,
        amountIn: amount,
        amountOutMinimum,
        sqrtPriceLimitX96: 0,
      };

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactInputSingle(
          swapParams,
        );

      const sweepTx = await contract.populateTransaction.sweepToken(
        WETH,
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        swapTx.data,
        sweepTx.data,
      ]);

      expect(await weth.balanceOf(account.address)).to.gte(
        wethBalance.add(amountOutMinimum),
      );
    });

    it('Should swap IERC20 for ETH (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 500n;
      const amountOutMinimum = 0;
      const amount = 2000n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const wethBalance = await weth.balanceOf(account.address);

      const swapParams = {
        fee,
        tokenIn: USDC,
        tokenOut: WETH,
        amountIn: amount,
        amountOutMinimum,
        sqrtPriceLimitX96: 0,
      };

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );

      const swapTx =
        await contract.populateTransaction.swapExactInputSingle(
          swapParams,
        );

      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        swapTx.data,
        unwrapTx.data,
      ]);

      expect(await weth.balanceOf(account.address)).to.gte(
        wethBalance.add(amountOutMinimum),
      );
    });

    it('Should swap ETH for IERC20 (exact input)', async () => {
      const { contract } = await loadFixture(deploy);

      const fee = 500n;
      const amount = 1n * 10n ** 18n;
      const amountOutMinimum = 1000n * 10n ** 6n;

      const usdcBalance = await usdc.balanceOf(account.address);

      const swapParams = {
        fee,
        tokenOut: USDC,
        amountOutMinimum,
        sqrtPriceLimitX96: 0,
      };

      await contract.swapExactInputSingleETH(swapParams, 0, {
        value: amount,
      });

      expect(await usdc.balanceOf(account.address)).to.gte(
        usdcBalance.add(amountOutMinimum),
      );
    });
  });

  describe('Mint', () => {
    it('Should mint a new position (USDC - ETH)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 500n;
      const amount0Min = 0;
      const amount1Min = 0;
      const tickLower = 202530 + 10;
      const tickUpper = 202530 + 100;
      const amount0 = 1630n * 10n ** 6n;
      const amount1 = 1n * 10n ** 18n;

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount0,
          },
        ],
        contract.address,
      );

      const ethBalanceBefore = await account.getBalance();
      const wethBalanceBefore = await weth.balanceOf(account.address);
      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const mintParams = {
        fee,
        amount0Desired: amount0,
        amount1Desired: amount1,
        tickLower,
        tickUpper,
        amount0Min,
        amount1Min,
        token0: USDC,
        token1: WETH,
      };

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
        0,
      );

      const sweepTx = await contract.populateTransaction.sweepToken(
        USDC,
        account.address,
      );

      const unwrapWETH9 =
        await contract.populateTransaction.unwrapWETH9(
          account.address,
        );

      await contract.multicall(
        [permitTx.data, mintTx.data, sweepTx.data, unwrapWETH9.data],
        {
          value: amount1,
        },
      );

      const ethBalanceAfter = await account.getBalance();
      const wethBalanceAfter = await weth.balanceOf(account.address);
      const usdcBalanceAfter = await usdc.balanceOf(account.address);

      expect(ethBalanceBefore).to.gte(ethBalanceAfter);
      expect(usdcBalanceBefore).to.gte(usdcBalanceAfter);
      expect(wethBalanceBefore).to.equal(wethBalanceAfter);
    });

    it('Should mint a new position (ETH - USDT)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 500n;
      const amount0Min = 0;
      const amount1Min = 0;
      const tickLower = -391440;
      const tickUpper = -187980;
      const amount0 = 1n * 10n ** 18n;
      const amount1 = 2000n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: USDT,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const ethBalanceBefore = await account.getBalance();
      const wethBalanceBefore = await weth.balanceOf(account.address);
      const usdtBalanceBefore = await usdt.balanceOf(account.address);

      const mintParams = {
        fee,
        amount0Desired: amount0,
        amount1Desired: amount1,
        tickLower,
        tickUpper,
        amount0Min,
        amount1Min,
        token0: WETH,
        token1: USDT,
      };

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
        0,
      );

      const sweepTx = await contract.populateTransaction.sweepToken(
        USDT,
        account.address,
      );

      const unwrapWETH9 =
        await contract.populateTransaction.unwrapWETH9(
          account.address,
        );

      await contract.multicall(
        [permitTx.data, mintTx.data, sweepTx.data, unwrapWETH9.data],
        {
          value: amount0,
        },
      );

      const ethBalanceAfter = await account.getBalance();
      const wethBalanceAfter = await weth.balanceOf(account.address);
      const usdtBalanceAfter = await usdt.balanceOf(account.address);

      expect(ethBalanceBefore).to.gte(ethBalanceAfter);
      expect(usdtBalanceBefore).to.gte(usdtBalanceAfter);
      expect(wethBalanceBefore).to.equal(wethBalanceAfter);
    });

    it('Should mint a new position (DAI - USDC)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 100n;
      const amount0Min = 0;
      const amount1Min = 0;
      const tickLower = -887272;
      const tickUpper = 887272;
      const amount0 = 100n * 10n ** 18n;
      const amount1 = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: DAI,
            amount: amount0,
          },
          {
            token: USDC,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);
      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const mintParams = {
        fee,
        amount0Desired: amount0,
        amount1Desired: amount1,
        tickLower,
        tickUpper,
        amount0Min,
        amount1Min,
        token0: DAI,
        token1: USDC,
      };

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
        0,
      );

      const sweepTx1 = await contract.populateTransaction.sweepToken(
        USDC,
        account.address,
      );

      const sweepTx2 = await contract.populateTransaction.sweepToken(
        DAI,
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        mintTx.data,
        sweepTx1.data,
        sweepTx2.data,
      ]);

      expect(await dai.balanceOf(account.address)).to.lt(
        daiBalanceBefore,
      );
      expect(await usdc.balanceOf(account.address)).to.lt(
        usdcBalanceBefore,
      );
    });

    it('Should mint a new position (USDC - WETH)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 500n;
      const amount0Min = 0;
      const amount1Min = 0;
      const tickLower = -210300;
      const tickUpper = -196440;
      const amount1 = 1n * 10n ** 18n;
      const amount2 = 1630n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount2,
          },
          {
            token: WETH,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);
      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const mintParams = {
        fee,
        amount0Desired: amount2,
        amount1Desired: amount1,
        tickLower,
        tickUpper,
        amount0Min,
        amount1Min,
        token0: USDC,
        token1: WETH,
      };

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
        0,
      );

      const sweepTx1 = await contract.populateTransaction.sweepToken(
        USDC,
        account.address,
      );

      const sweepTx2 = await contract.populateTransaction.sweepToken(
        WETH,
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        mintTx.data,
        sweepTx1.data,
        sweepTx2.data,
      ]);

      expect(await weth.balanceOf(account.address)).to.lt(
        wethBalanceBefore,
      );
      expect(await usdc.balanceOf(account.address)).to.lte(
        usdcBalanceBefore,
      );
    });

    it('Should mint a new position (USDC - ETH)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 500n;
      const amount0Min = 0;
      const amount1Min = 0;
      const tickLower = -210300;
      const tickUpper = -196440;
      const amount0 = 1n * 10n ** 18n;
      const amount1 = 2000n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const mintParams = {
        fee,
        amount0Desired: amount1,
        amount1Desired: amount0,
        tickLower,
        tickUpper,
        amount0Min,
        amount1Min,
        token0: USDC,
        token1: WETH,
      };

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
        0,
      );

      const sweepTx = await contract.populateTransaction.sweepToken(
        USDC,
        account.address,
      );

      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      await contract.multicall(
        [permitTx.data, mintTx.data, sweepTx.data, unwrapTx.data],
        {
          value: amount0,
        },
      );

      expect(await usdc.balanceOf(account.address)).to.lte(
        usdcBalanceBefore,
      );
    });

    it('Should mint a new position (USDC - USDT)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 100n;
      const amount0Min = 0;
      const amount1Min = 0;
      const tickLower = -887272;
      const tickUpper = 887272;
      const amount = 1000n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount,
          },
          {
            token: USDT,
            amount,
          },
        ],
        contract.address,
      );

      const usdtBalanceBefore = await usdt.balanceOf(account.address);
      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const mintParams = {
        fee,
        amount0Desired: amount,
        amount1Desired: amount,
        tickLower,
        tickUpper,
        amount0Min,
        amount1Min,
        token0: USDC,
        token1: USDT,
      };

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
        0,
      );

      const sweepTx1 = await contract.populateTransaction.sweepToken(
        USDC,
        account.address,
      );

      const sweepTx2 = await contract.populateTransaction.sweepToken(
        USDT,
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        mintTx.data,
        sweepTx1.data,
        sweepTx2.data,
      ]);

      expect(await usdt.balanceOf(account.address)).to.lt(
        usdtBalanceBefore,
      );
      expect(await usdc.balanceOf(account.address)).to.lt(
        usdcBalanceBefore,
      );
    });

    it('Should mint a new position (WETH - USDT)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 3000n;
      const amount0Min = 0;
      const amount1Min = 0;
      const tickLower = -391440;
      const tickUpper = -187980;
      const amount0 = 1n * 10n ** 18n;
      const amount1 = 2000n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: WETH,
            amount: amount0,
          },
          {
            token: USDT,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const mintParams = {
        fee,
        tickLower,
        tickUpper,
        amount0Min,
        amount1Min,
        token0: WETH,
        token1: USDT,
        amount0Desired: amount0,
        amount1Desired: amount1,
      };

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
        0,
      );

      const sweepTx1 = await contract.populateTransaction.sweepToken(
        WETH,
        account.address,
      );

      const sweepTx2 = await contract.populateTransaction.sweepToken(
        USDT,
        account.address,
      );

      await contract.multicall([
        permitTx.data,
        mintTx.data,
        sweepTx1.data,
        sweepTx2.data,
      ]);

      expect(await weth.balanceOf(account.address)).to.lt(
        wethBalanceBefore,
      );
    });

    it('Should mint a new position (WETH - USDT) and increaseLiquidity', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 3000n;
      const amount0Min = 0;
      const amount1Min = 0;
      const tickLower = -391440;
      const tickUpper = -187980;
      const amount0 = 1n * 10n ** 18n;
      const amount1 = 2000n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: WETH,
            amount: amount0,
          },
          {
            token: USDT,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);
      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const mintParams = {
        fee,
        amount0Desired: amount0,
        amount1Desired: amount1,
        tickLower,
        tickUpper,
        amount0Min,
        amount1Min,
        token0: WETH,
        token1: USDT,
      };

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
        0,
      );

      const sweepTx1 = await contract.populateTransaction.sweepToken(
        WETH,
        account.address,
      );

      const sweepTx2 = await contract.populateTransaction.sweepToken(
        USDT,
        account.address,
      );

      const tx = await contract.multicall([
        permitTx.data,
        mintTx.data,
        sweepTx1.data,
        sweepTx2.data,
      ]);

      const rc = await tx.wait();

      const wethBalanceAfter = await weth.balanceOf(account.address);
      const usdcBalanceAfter = await usdc.balanceOf(account.address);

      expect(wethBalanceAfter).to.lte(wethBalanceBefore);
      expect(usdcBalanceAfter).to.lte(usdcBalanceBefore);

      const event = rc?.events?.find((e) => e.event === 'Mint');
      const tokenId = event?.args?.[0];

      const amountAdd0 = 3n * 10n ** 18n;
      const amountAdd1 = 3000n * 10n ** 6n;

      const { permit: permit1, signature: signature1 } =
        await multiSign(
          [
            {
              token: WETH,
              amount: amountAdd0,
            },
            {
              token: USDT,
              amount: amountAdd1,
            },
          ],
          contract.address,
        );

      const increaseLiquidityParams = {
        tokenId,
        amountAdd0,
        amountAdd1,
        amount0Min: 0,
        amount1Min: 0,
        token0: WETH,
        token1: USDC,
      };

      const permitTx2 =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit1,
          signature1,
        );

      const increaseLiquidityTx =
        await contract.populateTransaction.increaseLiquidity(
          increaseLiquidityParams,
          0,
        );

      const sweepTx3 = await contract.populateTransaction.sweepToken(
        WETH,
        account.address,
      );

      const sweepTx4 = await contract.populateTransaction.sweepToken(
        USDT,
        account.address,
      );

      await contract.multicall([
        permitTx2.data,
        increaseLiquidityTx.data,
        sweepTx3.data,
        sweepTx4.data,
      ]);

      const wethBalanceAfter2 = await weth.balanceOf(account.address);
      const usdcBalanceAfter2 = await usdc.balanceOf(account.address);

      expect(wethBalanceAfter2).to.lte(wethBalanceAfter);
      expect(usdcBalanceAfter2).to.lte(usdcBalanceAfter);
    });

    it('Should mint a new position (WETH - USDT) and increaseLiquidity', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 3000n;
      const amount0Min = 0;
      const amount1Min = 0;
      const tickLower = -391440;
      const tickUpper = -187980;
      const amount0 = 1n * 10n ** 18n;
      const amount1 = 2000n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: WETH,
            amount: amount0,
          },
          {
            token: USDT,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);
      const usdtBalanceBefore = await usdt.balanceOf(account.address);

      const mintParams = {
        fee,
        amount0Desired: amount0,
        amount1Desired: amount1,
        tickLower,
        tickUpper,
        amount0Min,
        amount1Min,
        token0: WETH,
        token1: USDT,
      };

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
        0,
      );

      const sweepTx1 = await contract.populateTransaction.sweepToken(
        WETH,
        account.address,
      );

      const sweepTx2 = await contract.populateTransaction.sweepToken(
        USDT,
        account.address,
      );

      const tx = await contract.multicall([
        permitTx.data,
        mintTx.data,
        sweepTx1.data,
        sweepTx2.data,
      ]);

      const rc = await tx.wait();
      const event = rc?.events?.find((e) => e.event === 'Mint');
      const tokenId = event?.args?.[0];

      const wethBalanceAfter = await weth.balanceOf(account.address);
      const usdtBalanceAfter = await usdt.balanceOf(account.address);

      expect(wethBalanceAfter).to.lte(wethBalanceBefore);
      expect(usdtBalanceAfter).to.lte(usdtBalanceBefore);

      const amountAdd0 = 3n * 10n ** 18n;
      const amountAdd1 = 3000n * 10n ** 6n;

      const { permit: permit1, signature: signature1 } =
        await multiSign(
          [
            {
              token: WETH,
              amount: amountAdd0,
            },
            {
              token: USDT,
              amount: amountAdd1,
            },
          ],
          contract.address,
        );

      const increaseLiquidityParams = {
        tokenId,
        amountAdd0,
        amountAdd1,
        amount0Min: 0,
        amount1Min: 0,
        token0: WETH,
        token1: USDT,
      };

      const permitTx2 =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit1,
          signature1,
        );

      const increaseLiquidityTx =
        await contract.populateTransaction.increaseLiquidity(
          increaseLiquidityParams,
          0,
        );

      const sweepTx3 = await contract.populateTransaction.sweepToken(
        WETH,
        account.address,
      );

      const sweepTx4 = await contract.populateTransaction.sweepToken(
        USDT,
        account.address,
      );

      await contract.multicall([
        permitTx2.data,
        increaseLiquidityTx.data,
        sweepTx3.data,
        sweepTx4.data,
      ]);

      const wethBalanceAfter2 = await weth.balanceOf(account.address);
      const usdtBalanceAfter2 = await usdt.balanceOf(account.address);

      expect(wethBalanceAfter2).to.lte(wethBalanceAfter);
      expect(usdtBalanceAfter2).to.lte(usdtBalanceAfter);
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

      expect(await account.getBalance()).to.gt(balanceBefore);
    });
  });
});
