import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { IERC20 } from '../typechain-types';
import { USDT, WBTC, WETH } from '../utils/addresses';
import { impersonate, multiSigner, signer } from '../utils/helpers';

// Using tricrypto2 (USDT - WBTC - ETH)
const POOL = '0xd51a44d3fae010294c616388b506acda1bfaae46';
const POOL_TOKEN = '0xc4ad29ba4b3c580e6d59105fff484999997675ff';
const WHALE = '0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8';
const WBTC_WHALE = '0x845cbcb8230197f733b59cfe1795f282786f212c';

describe('Curve3Pool (USDT, WBTC, ETH)', () => {
  let usdt: IERC20;
  let wbtc: IERC20;
  let weth: Contract;
  let poolToken: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Curve3Token = await ethers.getContractFactory(
      'Curve3Token',
    );
    const contract = await Curve3Token.deploy(
      POOL,
      PERMIT2_ADDRESS,
      [USDT, WBTC, WETH],
      POOL_TOKEN,
      100,
    );

    return {
      contract,
      sign: await signer(account),
      multiSign: await multiSigner(account),
    };
  };

  before(async () => {
    const whale = await impersonate(WHALE);
    const wbtcWhale = await impersonate(WBTC_WHALE);
    [account] = await ethers.getSigners();

    weth = await ethers.getContractAt('IWETH9', WETH);
    usdt = await ethers.getContractAt('IERC20', USDT);
    wbtc = await ethers.getContractAt('IERC20', WBTC);
    poolToken = await ethers.getContractAt('IERC20', POOL_TOKEN);

    const usdtAmount = 1000n * 10n ** 6n;
    const wbtcAmount = 1000n * 10n ** 8n;
    const ethAmount = 1000n * 10n ** 18n;

    await usdt.connect(whale).transfer(account.address, usdtAmount);
    await wbtc
      .connect(wbtcWhale)
      .transfer(account.address, wbtcAmount);
    await weth.deposit({
      value: ethAmount,
    });

    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);
    expect(await usdt.balanceOf(account.address)).to.gte(usdtAmount);
    expect(await wbtc.balanceOf(account.address)).to.gte(wbtcAmount);

    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await wbtc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await poolToken.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Add Liquidity', () => {
    it('Adds liquidity only for USDT', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: USDT,
          },
        ],
        contract.address,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit,
        signature,
        [amount, 0, 0],
        0,
        100,
        {
          value: 5,
        },
      );
      // gasUsed: 315k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Adds liquidity only for WBTC', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 8n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: WBTC,
          },
        ],
        contract.address,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit,
        signature,
        [0, amount, 0],
        0,
        100,
        {
          value: 5,
        },
      );
      // gasUsed: 328k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Adds liquidity only for WETH', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: WETH,
          },
        ],
        contract.address,
      );

      await contract.addLiquidity(
        permit,
        signature,
        [0, 0, amount],
        0,
        100,
        {
          value: 5,
        },
      );
      // gasUsed: 296k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Adds liquidity for USDT + WBTC', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 8n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: USDT,
          },
          {
            amount: amount2,
            token: WBTC,
          },
        ],
        contract.address,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit,
        signature,
        [amount1, amount2, 0],
        0,
        100,
        {
          value: 5,
        },
      );
      // gasUsed: 447k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Adds liquidity for USDT + WETH', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 18n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: USDT,
          },
          {
            amount: amount2,
            token: WETH,
          },
        ],
        contract.address,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit,
        signature,
        [amount1, 0, amount2],
        0,
        100,
        {
          value: 5,
        },
      );
      // gasUsed: 384k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Adds liquidity for WBTC + WETH', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 8n;
      const amount2 = 100n * 10n ** 18n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: WBTC,
          },
          {
            amount: amount2,
            token: WETH,
          },
        ],
        contract.address,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit,
        signature,
        [0, amount1, amount2],
        0,
        100,
        {
          value: 5,
        },
      );
      // gasUsed: 432k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Adds liquidity for USDT + WBTC + WETH', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 8n;
      const amount3 = 100n * 10n ** 18n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: USDT,
          },
          {
            amount: amount2,
            token: WBTC,
          },
          {
            amount: amount2,
            token: WETH,
          },
        ],
        contract.address,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit,
        signature,
        [amount1, amount2, amount3],
        0,
        100,
        {
          value: 5,
        },
      );
      // gasUsed: 232k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });
  });

  describe('Remove Liquidity', () => {
    it('Should add liquidity and remove liquidity', async () => {
      const { contract, sign, multiSign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 8n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: WBTC,
          },
        ],
        contract.address,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit,
        signature,
        [0, amount, 0],
        0,
        100,
        {
          value: 5,
        },
      );
      // gasUsed: 328k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        account.address,
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolTokenBalanceAfter,
        },
        contract.address,
      );

      const usdtBalanceBefore = await usdt.balanceOf(account.address);
      const wbtcBalanceBefore = await wbtc.balanceOf(account.address);
      const wethBalanceBefore = await weth.balanceOf(account.address);

      await contract.removeLiquidity(permit2, signature2, [0, 0, 0]);
      // 259k

      expect(await usdt.balanceOf(account.address)).to.gt(
        usdtBalanceBefore,
      );
      expect(await wbtc.balanceOf(account.address)).to.gt(
        wbtcBalanceBefore,
      );
      expect(await weth.balanceOf(account.address)).to.gt(
        wethBalanceBefore,
      );
    });

    it('Should add liquidity and remove liquidity one coin', async () => {
      const { contract, sign, multiSign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 8n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: WBTC,
          },
        ],
        contract.address,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit,
        signature,
        [0, amount, 0],
        0,
        100,
        {
          value: 5,
        },
      );

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        account.address,
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolTokenBalanceAfter,
        },
        contract.address,
      );

      const usdtBalanceBefore = await usdt.balanceOf(account.address);

      await contract.removeLiquidityOneCoinU(
        permit2,
        signature2,
        2,
        0,
      );
      // gasUsed: 285k

      expect(await usdt.balanceOf(account.address)).to.gte(
        usdtBalanceBefore,
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
