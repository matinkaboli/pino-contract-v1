import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

import { IERC20 } from '../../typechain-types';
import { EURS, USDC, WETH, SETH } from '../utils/addresses';
import { signer, multiSigner, impersonate } from '../utils/helpers';

const WHALE = '0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8';
const EURS_WHALE = '0xcfb87039a1eda5428e2c8386d31ccf121835ecdb';
const SETH_WHALE = '0xa97bc5dd7b32003398645edeb2178c91087f86d8';
const CURVE_SWAP = '0x55b916ce078ea594c10a874ba67ecc3d62e29822';

describe('Curve2Pool (USDC - EURS)', () => {
  let usdc: IERC20;
  let eurs: IERC20;
  let seth: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Curve = await ethers.getContractFactory('Curve');
    const contract = await Curve.deploy(
      PERMIT2_ADDRESS,
      WETH,
      CURVE_SWAP,
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
    const sethWhale = await impersonate(SETH_WHALE);
    usdc = await ethers.getContractAt('IERC20', USDC);
    eurs = await ethers.getContractAt('IERC20', EURS);
    seth = await ethers.getContractAt('IERC20', SETH);

    const usdcAmount = 1000n * 10n ** 6n;
    const eursAmount = 1000n * 10n ** 2n;
    const sethAmount = 100n * 10n ** 18n;

    await usdc.connect(whale).transfer(account.address, usdcAmount);
    await eurs
      .connect(eursWhale)
      .transfer(account.address, eursAmount);
    await seth
      .connect(sethWhale)
      .transfer(account.address, sethAmount);

    expect(await usdc.balanceOf(account.address)).to.gte(usdcAmount);
    expect(await eurs.balanceOf(account.address)).to.gte(eursAmount);
    expect(await seth.balanceOf(account.address)).to.gte(sethAmount);

    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await eurs.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await seth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Add Liquidity', () => {
    it('Adds liquidity only for USDC', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const POOL = '0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b';
      const POOL_TOKEN = '0x3d229e1b4faab62f621ef2f6a610961f7bd7b23b';

      const proxyFee = 0n;
      const amount = 100n * 10n ** 6n; // of USDC
      const amounts = [amount, 0n];

      const { permit, signature } = await sign(
        {
          amount,
          token: USDC,
        },
        contract.address,
      );

      const poolToken = await ethers.getContractAt(
        'IERC20',
        POOL_TOKEN,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(USDC, [POOL]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const addTx = await contract.populateTransaction.addLiquidity(
        amounts,
        0,
        POOL,
        proxyFee,
      );
      const sweepTx = await contract.populateTransaction.sweepToken(
        POOL_TOKEN,
        account.address,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        addTx.data,
        sweepTx.data,
      ]);

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Adds liquidity only for EURS', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const POOL = '0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b';
      const POOL_TOKEN = '0x3d229e1b4faab62f621ef2f6a610961f7bd7b23b';

      const proxyFee = 0n;
      const amount = 100n * 10n ** 2n;
      const amounts = [0n, amount];

      const { permit, signature } = await sign(
        {
          amount,
          token: EURS,
        },
        contract.address,
      );

      const poolToken = await ethers.getContractAt(
        'IERC20',
        POOL_TOKEN,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(EURS, [POOL]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const addTx = await contract.populateTransaction.addLiquidity(
        amounts,
        0,
        POOL,
        proxyFee,
      );
      const sweepTx = await contract.populateTransaction.sweepToken(
        POOL_TOKEN,
        account.address,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        addTx.data,
        sweepTx.data,
      ]);

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Should add_liquidity for both tokens', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const POOL = '0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b';
      const POOL_TOKEN = '0x3d229e1b4faab62f621ef2f6a610961f7bd7b23b';

      const proxyFee = 0n;
      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 2n;
      const amounts = [amount1, amount2];

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

      const poolToken = await ethers.getContractAt(
        'IERC20',
        POOL_TOKEN,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(EURS, [POOL]);
      const approveTx2 =
        await contract.populateTransaction.approveToken(USDC, [POOL]);
      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit,
          signature,
        );
      const addTx = await contract.populateTransaction.addLiquidity(
        amounts,
        0,
        POOL,
        proxyFee,
      );
      const sweepTx = await contract.populateTransaction.sweepToken(
        POOL_TOKEN,
        account.address,
      );

      await contract.multicall([
        approveTx.data,
        approveTx2.data,
        permitTx.data,
        addTx.data,
        sweepTx.data,
      ]);

      expect(await poolToken.balanceOf(account.address)).to.gt(
        poolTokenBalanceBefore,
      );
    });

    it('Should add SETH as liquidity', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const POOL = '0xc5424b857f758e906013f3555dad202e4bdb4567';
      const POOL_TOKEN = '0xa3d87fffce63b53e0d54faa1cc983b7eb0b74a9c';

      const proxyFee = 0n;
      const amount = 10n * 10n ** 18n; // of SETH
      const minAmount = 8n * 10n ** 18n;
      const amounts = [0n, amount];

      const { permit, signature } = await sign(
        {
          amount,
          token: SETH,
        },
        contract.address,
      );

      const poolToken = await ethers.getContractAt(
        'IERC20',
        POOL_TOKEN,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(SETH, [POOL]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const addTx = await contract.populateTransaction.addLiquidity(
        amounts,
        0,
        POOL,
        proxyFee,
      );
      const sweepTx = await contract.populateTransaction.sweepToken(
        POOL_TOKEN,
        account.address,
      );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        addTx.data,
        sweepTx.data,
      ]);

      expect(await poolToken.balanceOf(account.address)).to.gt(
        poolTokenBalanceBefore.add(minAmount),
      );
    });

    it('Should add ETH as liquidity (ETH - SETH)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const POOL = '0xc5424b857f758e906013f3555dad202e4bdb4567';
      const POOL_TOKEN = '0xa3d87fffce63b53e0d54faa1cc983b7eb0b74a9c';

      const proxyFee = 0n;
      const amount = 10n * 10n ** 18n; // of ETH
      const minAmount = 8n * 10n ** 18n;
      const amounts = [amount, 0n];

      const poolToken = await ethers.getContractAt(
        'IERC20',
        POOL_TOKEN,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      const addTx = await contract.populateTransaction.addLiquidity(
        amounts,
        0,
        POOL,
        proxyFee,
      );
      const sweepTx = await contract.populateTransaction.sweepToken(
        POOL_TOKEN,
        account.address,
      );

      await contract.multicall([addTx.data, sweepTx.data], {
        value: amount + proxyFee,
      });

      expect(await poolToken.balanceOf(account.address)).to.gt(
        poolTokenBalanceBefore.add(minAmount),
      );
    });

    it('Should add ETH and SETH as liquidity (ETH - SETH)', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const POOL = '0xc5424b857f758e906013f3555dad202e4bdb4567';
      const POOL_TOKEN = '0xa3d87fffce63b53e0d54faa1cc983b7eb0b74a9c';

      const proxyFee = 5n;
      const amount = 1n * 10n ** 18n; // of ETH and SETH
      const amounts = [amount, amount];

      const { permit, signature } = await sign(
        {
          amount,
          token: SETH,
        },
        contract.address,
      );

      const poolToken = await ethers.getContractAt(
        'IERC20',
        POOL_TOKEN,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(SETH, [POOL]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const addTx = await contract.populateTransaction.addLiquidity(
        amounts,
        0,
        POOL,
        proxyFee,
      );
      const sweepTx = await contract.populateTransaction.sweepToken(
        POOL_TOKEN,
        account.address,
      );

      await contract.multicall(
        [approveTx.data, permitTx.data, addTx.data, sweepTx.data],
        {
          value: amount + proxyFee,
        },
      );

      expect(await poolToken.balanceOf(account.address)).to.gt(
        poolTokenBalanceBefore,
      );
    });
  });

  describe('Remove Liquidity', () => {
    it('Should add_liquidity for 2 tokens and remove_liquidity', async () => {
      const { contract, sign, multiSign } = await loadFixture(deploy);

      const POOL = '0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b';
      const POOL_TOKEN = '0x3d229e1b4faab62f621ef2f6a610961f7bd7b23b';

      const proxyFee = 0n;
      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 2n;
      const amounts = [amount1, amount2];

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

      const poolToken = await ethers.getContractAt(
        'IERC20',
        POOL_TOKEN,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(EURS, [POOL]);
      const approveTx2 =
        await contract.populateTransaction.approveToken(USDC, [POOL]);
      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit1,
          signature1,
        );
      const addTx = await contract.populateTransaction.addLiquidity(
        amounts,
        0,
        POOL,
        proxyFee,
      );
      const sweepTx = await contract.populateTransaction.sweepToken(
        POOL_TOKEN,
        account.address,
      );

      await contract.multicall([
        approveTx.data,
        approveTx2.data,
        permitTx.data,
        addTx.data,
        sweepTx.data,
      ]);

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

      // Now poolToken approves PERMIT2
      await poolToken.approve(PERMIT2_ADDRESS, constants.MaxUint256);

      const usdcBalanceBefore = await usdc.balanceOf(account.address);
      const eursBalanceBefore = await eurs.balanceOf(account.address);

      const permitTx2 =
        await contract.populateTransaction.permitTransferFrom(
          permit2,
          signature2,
        );
      const removeLiquidityTx =
        await contract.populateTransaction.removeLiquidity(
          poolTokenBalanceAfter,
          [0, 0],
          POOL,
        );
      const sweepTx1 = await contract.populateTransaction.sweepToken(
        USDC,
        account.address,
      );
      const sweepTx2 = await contract.populateTransaction.sweepToken(
        EURS,
        account.address,
      );

      await contract.multicall([
        permitTx2.data,
        removeLiquidityTx.data,
        sweepTx1.data,
        sweepTx2.data,
      ]);

      expect(await usdc.balanceOf(account.address)).to.be.gt(
        usdcBalanceBefore,
      );
      expect(await eurs.balanceOf(account.address)).to.be.gt(
        eursBalanceBefore,
      );
    });

    it('Should add_liquidity for 2 tokens and remove_one_coin', async () => {
      const { contract, sign, multiSign } = await loadFixture(deploy);

      const POOL = '0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b';
      const POOL_TOKEN = '0x3d229e1b4faab62f621ef2f6a610961f7bd7b23b';

      const proxyFee = 0n;
      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 2n;
      const amounts = [amount1, amount2];

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

      const poolToken = await ethers.getContractAt(
        'IERC20',
        POOL_TOKEN,
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        account.address,
      );

      const approveTx =
        await contract.populateTransaction.approveToken(EURS, [POOL]);
      const approveTx2 =
        await contract.populateTransaction.approveToken(USDC, [POOL]);
      const permitTx =
        await contract.populateTransaction.permitBatchTransferFrom(
          permit1,
          signature1,
        );
      const addTx = await contract.populateTransaction.addLiquidity(
        amounts,
        0,
        POOL,
        proxyFee,
      );
      const sweepTx = await contract.populateTransaction.sweepToken(
        POOL_TOKEN,
        account.address,
      );

      await contract.multicall([
        approveTx.data,
        approveTx2.data,
        permitTx.data,
        addTx.data,
        sweepTx.data,
      ]);

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

      await poolToken.approve(PERMIT2_ADDRESS, constants.MaxUint256);

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const permitTx2 =
        await contract.populateTransaction.permitTransferFrom(
          permit2,
          signature2,
        );
      const removeLiquidityTx =
        await contract.populateTransaction.removeLiquidityOneCoinU(
          poolTokenBalanceAfter,
          0,
          [0, 0],
          POOL,
        );
      const sweepTx1 = await contract.populateTransaction.sweepToken(
        USDC,
        account.address,
      );

      await contract.multicall([
        permitTx2.data,
        removeLiquidityTx.data,
        sweepTx1.data,
      ]);

      expect(await usdc.balanceOf(account.address)).to.be.gte(
        usdcBalanceBefore,
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

      await contract.withdrawAdmin(account.address);

      expect(await account.getBalance()).to.gt(balanceBefore);
    });
  });
});
