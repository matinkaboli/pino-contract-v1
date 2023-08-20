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
import { impersonate, multiSigner, signer } from '../utils/helpers';
import { IERC20, IWETH9 } from '../../typechain-types';
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
const NFPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const SWAP_ROUTER_2 = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';

describe('Uniswap', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let lusd: IERC20;
  let weth: IWETH9;
  let account: SignerWithAddress;

  const deploy = async () => {
    const IUNISWAP = await ethers.getContractFactory('Uniswap');

    const contract = await IUNISWAP.deploy(
      PERMIT2_ADDRESS,
      WETH,
      SWAP_ROUTER_2,
      NFPM,
    );

    await contract.approveToken(DAI, [NFPM, SWAP_ROUTER_2]);
    await contract.approveToken(USDC, [NFPM, SWAP_ROUTER_2]);
    await contract.approveToken(USDT, [NFPM, SWAP_ROUTER_2]);
    await contract.approveToken(LUSD, [NFPM, SWAP_ROUTER_2]);

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

      if (!calldata) {
        throw Error('Could not find a path');
      }

      const lusdBalanceBefore = await lusd.balanceOf(account.address);

      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx = await contract.populateTransaction.swap(
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

      const swapTx = await contract.populateTransaction.swap(
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

      const swapTx = await contract.populateTransaction.swap(
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

      const swapTx = await contract.populateTransaction.swap(
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

      const swapTx = await contract.populateTransaction.swap(
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
      const swapTx = await contract.populateTransaction.swap(
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

      const swapTx = await contract.populateTransaction.swap(
        calldata,
      );

      await contract.multicall([wrapTx.data, swapTx.data], {
        value: amount,
      });

      const daiBalanceAfter = await dai.balanceOf(account.address);

      expect(daiBalanceAfter).to.gt(daiBalanceBefore);
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

      const wrapTx = await contract.populateTransaction.wrapETH(0);

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
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
        [
          wrapTx.data,
          permitTx.data,
          mintTx.data,
          sweepTx.data,
          unwrapWETH9.data,
        ],
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

      const wrapTx = await contract.populateTransaction.wrapETH(0);

      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );

      const mintTx = await contract.populateTransaction.mint(
        mintParams,
      );

      const sweepTx = await contract.populateTransaction.sweepToken(
        USDC,
        account.address,
      );

      const unwrapTx = await contract.populateTransaction.unwrapWETH9(
        account.address,
      );

      await contract.multicall(
        [
          wrapTx.data,
          permitTx.data,
          mintTx.data,
          sweepTx.data,
          unwrapTx.data,
        ],
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

  describe('Find bugs', () => {
    it('Should revert if wrapETH is called more than once', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = ethers.utils.parseEther('1');

      // First, we send 2 eth to the contract (consider this amount a proxy fee that's accumulated)
      await account.sendTransaction({
        to: contract.address,
        value: amount.mul(2),
      });

      // Make sure the contract has at least 2 ETH
      expect(
        await ethers.provider.getBalance(contract.address),
      ).to.gte(amount.mul(2));

      const wethBalanceBefore = await weth.balanceOf(account.address);

      // Now we try to send 1 Eth but call wrapETH 2 times, we send 1 ETH but expect to receive
      // 2 WETH in multicall
      const wrapTx = await contract.populateTransaction.wrapETH(0);
      const sweepTx = await contract.populateTransaction.sweepToken(
        WETH,
        account.address,
      );

      await expect(
        contract.multicall([wrapTx.data, wrapTx.data, sweepTx.data], {
          value: amount,
        }),
      ).to.be.reverted;

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.equal(wethBalanceBefore);
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
