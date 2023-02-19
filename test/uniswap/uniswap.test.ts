import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { expect } from 'chai';
import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-network-helpers';
import { IERC20, IWETH9 } from '../../typechain-types';
import {
  USDC,
  USDT,
  DAI,
  WBTC,
  WETH,
  WHALE3POOL,
} from '../utils/addresses.ts';
import { impersonate, multiSigner, signer } from '../utils/helpers';

const NFPD = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const WBTC_WHALE = '0x845cbcb8230197f733b59cfe1795f282786f212c';

describe('Uniswap', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let weth: IWETH9;
  let wbtc: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Uniswap = await ethers.getContractFactory('Uniswap');
    const contract = await Uniswap.deploy(
      SWAP_ROUTER,
      PERMIT2_ADDRESS,
      NFPD,
      WETH,
      [USDC, USDT, DAI, WETH],
    );

    return {
      contract,
      sign: await signer(account),
      multiSign: await multiSigner(account),
    };
  };

  before(async () => {
    [account] = await ethers.getSigners();
    const whale = await impersonate(WHALE3POOL);
    const wbtcWhale = await impersonate(WBTC_WHALE);

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    weth = await ethers.getContractAt('IWETH9', WETH);
    wbtc = await ethers.getContractAt('IERC20', WBTC);

    const amount1 = 5000n * 10n ** 6n;
    const amount2 = 5000n * 10n ** 18n;
    const amount3 = 5000n * 10n ** 8n;

    await weth.deposit({ value: amount2 });
    await dai.connect(whale).transfer(account.address, amount2);
    await usdc.connect(whale).transfer(account.address, amount1);
    await usdt.connect(whale).transfer(account.address, amount1);
    await wbtc.connect(wbtcWhale).transfer(account.address, amount3);

    expect(await dai.balanceOf(account.address)).to.gte(amount2);
    expect(await weth.balanceOf(account.address)).to.gte(amount2);
    expect(await usdc.balanceOf(account.address)).to.gte(amount1);
    expect(await usdt.balanceOf(account.address)).to.gte(amount1);
    expect(await wbtc.balanceOf(account.address)).to.gte(amount3);

    await dai.approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
    await usdc.approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
    await wbtc
      .connect(account)
      .approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
  });

  describe.skip('Swap ERC20 to ERC20', () => {
    it('Should swap USDC to DAI using (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;
      const fee = 100n;
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

      await contract.swapExactInputSingle(
        fee,
        DAI,
        amountOutMinimum,
        0,
        false,
        permit,
        signature,
      );
      // gasUsed: 180k

      expect(await usdc.balanceOf(account.address)).to.equal(
        usdcBefore.sub(amount),
      );
      expect(await dai.balanceOf(account.address)).to.gte(
        daiBefore.add(amountOutMinimum),
      );
    });

    it('Should swap USDC to USDT using (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;
      const fee = 100n;
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

      await contract.swapExactInputSingle(
        fee,
        USDT,
        amountOutMinimum,
        0,
        false,
        permit,
        signature,
      );
      // gasUsed: 191k

      expect(await usdc.balanceOf(account.address)).to.equal(
        usdcBefore.sub(amount),
      );
      expect(await usdt.balanceOf(account.address)).to.gte(
        usdtBefore.add(amountOutMinimum),
      );
    });

    it('Should swap DAI to USDC using (exact output)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 18n;
      const fee = 100n;
      const amountOut = 950n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          amount,
          token: DAI,
        },
        contract.address,
      );

      const usdcBefore = await usdc.balanceOf(account.address);

      await contract.swapExactOutputSingle(
        fee,
        USDC,
        amountOut,
        0,
        permit,
        signature,
      );
      // gasUsed: 172k

      expect(await usdc.balanceOf(account.address)).to.equal(
        usdcBefore.add(amountOut),
      );
    });

    it('Should swap USDT to USDC using (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;
      const fee = 100n;
      const amountOut = 950n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDT,
        },
        contract.address,
      );

      const usdcBefore = await usdc.balanceOf(account.address);

      await contract.swapExactOutputSingle(
        fee,
        USDC,
        amountOut,
        0,
        permit,
        signature,
      );
      // gasUsed: 188k

      expect(await usdc.balanceOf(account.address)).to.gte(
        usdcBefore.add(amountOut),
      );
    });
  });

  describe.skip('Swap ERC20 to ETH', () => {
    it('Should swap IERC20 for ETH (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 500n;
      const amount = 2000n * 10n ** 6n;
      const amountOutMinimum = 0;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const ethBalance = await account.getBalance();

      await contract.swapExactInputSingle(
        fee,
        WETH,
        amountOutMinimum,
        0,
        true,
        permit,
        signature,
      );
      // gasUsed: 190k

      expect(await account.getBalance()).to.gte(ethBalance);
    });

    it('Should swap IERC20 for WETH (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 500n;
      const amount = 2000n * 10n ** 6n;
      const amountOutMinimum = 0;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const wethBalance = await weth.balanceOf(account.address);

      await contract.swapExactInputSingle(
        fee,
        WETH,
        amountOutMinimum,
        0,
        false,
        permit,
        signature,
      );
      // gasUsed: 177k

      expect(await weth.balanceOf(account.address)).to.gte(
        wethBalance.add(amountOutMinimum),
      );
    });

    it('Should swap IERC20 for ETH (exact input)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 500n;
      const amount = 2000n * 10n ** 6n;
      const amountOutMinimum = 0;

      const { permit, signature } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const wethBalance = await weth.balanceOf(account.address);

      await contract.swapExactInputSingle(
        fee,
        WETH,
        amountOutMinimum,
        0,
        false,
        permit,
        signature,
      );
      // gasUsed: 177k

      expect(await weth.balanceOf(account.address)).to.gte(
        wethBalance.add(amountOutMinimum),
      );
    });

    it('Should dwap ETH for IERC20 (exact input)', async () => {
      const { contract } = await loadFixture(deploy);

      const fee = 500n;
      const amount = 1n * 10n ** 18n;
      const amountOutMinimum = 1000n * 10n ** 6n;

      const usdcBalance = await usdc.balanceOf(account.address);

      await contract.swapExactInputSingleETH(
        fee,
        USDC,
        amountOutMinimum,
        0,
        0,
        {
          value: amount,
        },
      );
      // gasUsed: 127k

      expect(await usdc.balanceOf(account.address)).to.gte(
        usdcBalance.add(amountOutMinimum),
      );
    });
  });

  describe('Other liquidity functions', () => {
    it('Should mint a new position (USDC - ETH) and collectAllFees', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 500n;
      const minAmount1 = 0;
      const minAmount2 = 0;
      const lowerTick = -210300;
      const upperTick = -196440;
      const amount1 = 1n * 10n ** 18n;
      const amount2 = 1630n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount2,
          },
        ],
        contract.address,
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const tx = await contract.mintNewPosition(
        fee,
        lowerTick,
        upperTick,
        minAmount1,
        minAmount2,
        permit,
        signature,
        { value: amount1 },
      );
      const rc = await tx.wait();
      // gasUsed: 302k

      const usdcBalanceAfter = await usdc.balanceOf(account.address);
      expect(usdcBalanceAfter).to.lte(usdcBalanceBefore);

      if (!rc.events) {
        return;
      }

      const event = rc.events.find(
        (e) => e.event === 'DepositCreated',
      );

      if (!event) {
        return;
      }

      const tokenId = event.args[1];

      const deposit = await contract.deposits(tokenId);

      // Increate the time to 2 years to get some APY
      const TWO_YEAR_AFTER = 60 * 60 * 24 * 365 * 2;
      const now = await time.latest();
      await time.increaseTo(now + TWO_YEAR_AFTER);

      await contract.collectAllFees(tokenId, 100, 100);

      const usdcBalanceAfter2 = await usdc.balanceOf(account.address);

      expect(usdcBalanceAfter2).to.gt(usdcBalanceAfter);
    });

    it('Should mint a new position (USDC - USDT) and decreaseLiquidity', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 100n;
      const minAmount1 = 0;
      const minAmount2 = 0;
      const lowerTick = -887272;
      const upperTick = 887272;
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

      const tx = await contract.mintNewPosition(
        fee,
        lowerTick,
        upperTick,
        minAmount1,
        minAmount2,
        permit,
        signature,
      );
      const rc = await tx.wait();
      // gasUsed: 500k

      const usdcBalanceAfter = await usdc.balanceOf(account.address);
      const usdtBalanceAfter = await usdt.balanceOf(account.address);

      expect(usdtBalanceAfter).to.lt(usdtBalanceBefore);
      expect(usdcBalanceAfter).to.lt(usdcBalanceBefore);

      if (!rc.events) {
        return;
      }

      const event = rc.events.find(
        (e) => e.event === 'DepositCreated',
      );

      if (!event) {
        return;
      }

      const tokenId = event.args[1];

      const deposit = await contract.deposits(tokenId);

      await contract.decreaseLiquidity(tokenId, deposit[1], 0, 0);

      const usdcBalanceAfter2 = await usdc.balanceOf(account.address);
      const usdtBalanceAfter2 = await usdt.balanceOf(account.address);

      expect(usdcBalanceAfter2).to.gt(usdcBalanceAfter);
      expect(usdtBalanceAfter2).to.gt(usdtBalanceAfter);
    });

    it('Should mint a new position (WETH - USDT) and increaseLiquidity', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 3000n;
      const minAmount1 = 0;
      const minAmount2 = 0;
      const lowerTick = -391440;
      const upperTick = -187980;
      const amount1 = 1n * 10n ** 18n;
      const amount2 = 2000n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: WETH,
            amount: amount1,
          },
          {
            token: USDT,
            amount: amount2,
          },
        ],
        contract.address,
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const tx = await contract.mintNewPosition(
        fee,
        lowerTick,
        upperTick,
        minAmount1,
        minAmount2,
        permit,
        signature,
      );
      const rc = await tx.wait();
      // gasUsed: 500k

      const wethBalanceAfter = await wbtc.balanceOf(account.address);

      expect(wethBalanceAfter).to.lt(wethBalanceBefore);

      if (!rc.events) {
        return;
      }

      const event = rc.events.find(
        (e) => e.event === 'DepositCreated',
      );

      if (!event) {
        return;
      }

      const tokenId = event.args[1];

      const newAmountToAdd1 = 3n * 10n ** 18n;
      const newAmountToAdd2 = 3000n * 10n ** 6n;

      const { permit: permit1, signature: signature1 } =
        await multiSign(
          [
            {
              token: WETH,
              amount: newAmountToAdd1,
            },
            {
              token: USDT,
              amount: newAmountToAdd2,
            },
          ],
          contract.address,
        );

      await contract.increaseLiquidity(
        tokenId,
        newAmountToAdd1,
        newAmountToAdd2,
        0,
        0,
        permit1,
        signature1,
      );

      const wethBalanceAfter2 = await wbtc.balanceOf(account.address);

      expect(wethBalanceAfter2).to.lte(wethBalanceAfter);
    });
  });

  describe.skip('Mint', () => {
    it('Should mint a new position (DAI - USDC)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 100n;
      const minAmount1 = 0;
      const minAmount2 = 0;
      const lowerTick = -887272;
      const upperTick = 887272;
      const amount1 = 100n * 10n ** 18n;
      const amount2 = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: DAI,
            amount: amount1,
          },
          {
            token: USDC,
            amount: amount2,
          },
        ],
        contract.address,
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);
      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await contract.mintNewPosition(
        fee,
        lowerTick,
        upperTick,
        minAmount1,
        minAmount2,
        permit,
        signature,
      );
      // gasUsed: 500k

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
      const minAmount1 = 0;
      const minAmount2 = 0;
      const lowerTick = -210300;
      const upperTick = -196440;
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

      await contract.mintNewPosition(
        fee,
        lowerTick,
        upperTick,
        minAmount1,
        minAmount2,
        permit,
        signature,
      );
      // gasUsed: 500k

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
      const minAmount1 = 0;
      const minAmount2 = 0;
      const lowerTick = -210300;
      const upperTick = -196440;
      const amount1 = 1n * 10n ** 18n;
      const amount2 = 1630n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount2,
          },
        ],
        contract.address,
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await contract.mintNewPosition(
        fee,
        lowerTick,
        upperTick,
        minAmount1,
        minAmount2,
        permit,
        signature,
        { value: amount1 },
      );
      // gasUsed: 500k

      expect(await usdc.balanceOf(account.address)).to.lte(
        usdcBalanceBefore,
      );
    });

    it('Should mint a new position (USDC - USDT)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 100n;
      const minAmount1 = 0;
      const minAmount2 = 0;
      const lowerTick = -887272;
      const upperTick = 887272;
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

      await contract.mintNewPosition(
        fee,
        lowerTick,
        upperTick,
        minAmount1,
        minAmount2,
        permit,
        signature,
      );
      // gasUsed: 500k

      expect(await usdt.balanceOf(account.address)).to.lt(
        usdtBalanceBefore,
      );
      expect(await usdc.balanceOf(account.address)).to.lt(
        usdcBalanceBefore,
      );
    });

    it('Should mint a new position (WBTC - USDC)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 3000n;
      const minAmount1 = 0;
      const minAmount2 = 0;
      const lowerTick = 36780;
      const upperTick = 68940;
      const amount1 = 1n * 10n ** 8n;
      const amount2 = 21498n * 10n ** 6n;

      await contract.approveToken(WBTC);

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount2,
          },
          {
            token: WBTC,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const wbtcBalanceBefore = await wbtc.balanceOf(account.address);
      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await contract.mintNewPosition(
        fee,
        lowerTick,
        upperTick,
        minAmount1,
        minAmount2,
        permit,
        signature,
      );
      // gasUsed: 500k

      expect(await wbtc.balanceOf(account.address)).to.lt(
        wbtcBalanceBefore,
      );
      expect(await usdc.balanceOf(account.address)).to.lt(
        usdcBalanceBefore,
      );
    });

    it('Should mint a new position (WETH - USDT)', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const fee = 3000n;
      const minAmount1 = 0;
      const minAmount2 = 0;
      const lowerTick = -391440;
      const upperTick = -187980;
      const amount1 = 1n * 10n ** 18n;
      const amount2 = 2000n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            token: WETH,
            amount: amount1,
          },
          {
            token: USDT,
            amount: amount2,
          },
        ],
        contract.address,
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);

      await contract.mintNewPosition(
        fee,
        lowerTick,
        upperTick,
        minAmount1,
        minAmount2,
        permit,
        signature,
      );
      // gasUsed: 500k

      expect(await wbtc.balanceOf(account.address)).to.lt(
        wethBalanceBefore,
      );
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

      await contract.withdrawAdmin();

      expect(await account.getBalance()).to.gt(balanceBefore);
    });
  });
});
