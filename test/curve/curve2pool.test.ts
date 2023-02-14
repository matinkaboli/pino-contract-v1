import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { IERC20 } from '../typechain-types';
import { EURS, USDC } from '../utils/addresses';
import { signer, multiSigner, impersonate } from '../utils/helpers';

const POOL = '0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b';
const POOL_TOKEN = '0x3d229e1b4faab62f621ef2f6a610961f7bd7b23b';
const WHALE = '0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8';
const EURS_WHALE = '0xcfb87039a1eda5428e2c8386d31ccf121835ecdb';

describe('Curve2Pool (USDC - EURS)', () => {
  let usdc: IERC20;
  let eurs: IERC20;
  let poolToken: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Curve2Token = await ethers.getContractFactory(
      'Curve2Token',
    );
    const contract = await Curve2Token.deploy(
      POOL,
      PERMIT2_ADDRESS,
      [USDC, EURS],
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
    [account] = await ethers.getSigners();

    const whale = await impersonate(WHALE);
    const eursWhale = await impersonate(EURS_WHALE);
    usdc = await ethers.getContractAt('IERC20', USDC);
    eurs = await ethers.getContractAt('IERC20', EURS);
    poolToken = await ethers.getContractAt('IERC20', POOL_TOKEN);

    const usdcAmount = 1000n * 10n ** 6n;
    const eursAmount = 1000n * 10n ** 2n;

    await usdc.connect(whale).transfer(account.address, usdcAmount);
    await eurs
      .connect(eursWhale)
      .transfer(account.address, eursAmount);

    expect(await usdc.balanceOf(account.address)).to.gte(usdcAmount);
    expect(await eurs.balanceOf(account.address)).to.gte(eursAmount);

    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await eurs.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await poolToken.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Add Liquidity', () => {
    it('Adds liquidity only for USDC', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: USDC,
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
        [amount, 0],
        0,
        100,
        {
          value: 1,
        },
      );
      // gasUsed: 431k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Adds liquidity only for EURS', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 2n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: EURS,
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
        [0, amount],
        0,
        100,
        {
          value: 1,
        },
      );
      // gasUsed: 429k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Should add_liquidity for both tokens', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 2n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: USDC,
          },
          {
            amount: amount2,
            token: EURS,
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
        [amount1, amount2],
        0,
        100,
        {
          value: 1,
        },
      );
      // gasUsed: 517k

      expect(await poolToken.balanceOf(account.address)).to.gt(
        poolTokenBalanceBefore,
      );
    });
  });

  describe('Remove Liquidity', () => {
    it('Should add_liquidity for 2 tokens and remove_liquidity', async () => {
      const { contract, sign, multiSign } = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 2n;

      const { permit: permit1, signature: signature1 } =
        await multiSign(
          [
            {
              amount: amount1,
              token: USDC,
            },
            {
              amount: amount2,
              token: EURS,
            },
          ],
          contract.address,
        );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit1,
        signature1,
        [amount1, amount2],
        0,
        100,
        {
          value: 1,
        },
      );
      // gasUsed: 517k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        account.address,
      );

      expect(poolTokenBalanceAfter).to.be.gte(poolTokenBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolTokenBalanceAfter,
        },
        contract.address,
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);
      const eursBalanceBefore = await eurs.balanceOf(account.address);

      await contract.removeLiquidity(permit2, signature2, [0, 0], {
        value: 1,
      });
      // gasUsed: 230k

      expect(await usdc.balanceOf(account.address)).to.be.gt(
        usdcBalanceBefore,
      );
      expect(await eurs.balanceOf(account.address)).to.be.gt(
        eursBalanceBefore,
      );
    });

    it('Should add_liquidity for 2 tokens and remove_one_coin', async () => {
      const { contract, sign, multiSign } = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 2n;

      const { permit: permit1, signature: signature1 } =
        await multiSign(
          [
            {
              amount: amount1,
              token: USDC,
            },
            {
              amount: amount2,
              token: EURS,
            },
          ],
          contract.address,
        );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      await contract.addLiquidity(
        permit1,
        signature1,
        [amount1, amount2],
        0,
        100,
        {
          value: 1,
        },
      );
      // gasUsed: 517k

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

      const eursBalanceBefore = await eurs.balanceOf(account.address);

      await contract.removeLiquidityOneCoinU(
        permit2,
        signature2,
        0,
        0,
        {
          value: 1,
        },
      );
      // gasUsed: 230k

      expect(await eurs.balanceOf(account.address)).to.be.gte(
        eursBalanceBefore,
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
