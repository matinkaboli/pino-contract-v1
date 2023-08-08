import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

import { IERC20, IWETH9 } from '../../typechain-types';
import { impersonate, signer } from '../utils/helpers';
import {
  DAI,
  ETH,
  FRAX,
  WETH,
  EURS,
  USDC,
  USDT,
} from '../utils/addresses';

const WHALE = '0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8';
const REN_BTC = '0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D';
const EURS_WHALE = '0xcfb87039a1eda5428e2c8386d31ccf121835ecdb';
const CURVE_SWAP = '0x55b916ce078ea594c10a874ba67ecc3d62e29822';

describe('CurveSwap', () => {
  let weth: IWETH9;
  let dai: IERC20;
  let eurs: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let frax: IERC20;
  let renBtc: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Curve2Token = await ethers.getContractFactory('Curve');

    const contract = await Curve2Token.deploy(
      PERMIT2_ADDRESS,
      WETH,
      CURVE_SWAP,
    );

    return {
      contract,
      sign: await signer(account),
    };
  };

  before(async () => {
    const whale = await impersonate(WHALE);
    const eursWhale = await impersonate(EURS_WHALE);
    [account] = await ethers.getSigners();

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    eurs = await ethers.getContractAt('IERC20', EURS);
    frax = await ethers.getContractAt('IERC20', FRAX);
    weth = await ethers.getContractAt('IWETH9', WETH);
    renBtc = await ethers.getContractAt('IERC20', REN_BTC);

    const amount = 1000n * 10n ** 6n;
    const eursAmount = 1000n * 10n ** 2n;
    const daiAmount = 1000n * 10n ** 18n;

    await usdc.connect(whale).transfer(account.address, amount);
    await usdt.connect(whale).transfer(account.address, amount);
    await dai.connect(whale).transfer(account.address, daiAmount);
    await eurs
      .connect(eursWhale)
      .transfer(account.address, eursAmount);
    await weth.deposit({
      value: daiAmount,
    });

    expect(await usdt.balanceOf(account.address)).to.gte(amount);
    expect(await usdc.balanceOf(account.address)).to.gte(amount);
    expect(await dai.balanceOf(account.address)).to.gte(daiAmount);
    expect(await eurs.balanceOf(account.address)).to.gte(eursAmount);
    expect(await weth.balanceOf(account.address)).to.gte(daiAmount);

    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await dai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await eurs.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Exchange', () => {
    it('Should exchange DAI for USDC', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n; // of DAI
      const minimumReceived = 90n * 10n ** 6n; // of USDC

      const { permit, signature } = await sign(
        {
          amount,
          token: DAI,
        },
        contract.address,
      );

      const routes = [
        DAI, // initial token
        '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', // frax
        USDC,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const swapParams = [
        [0, 1, 1],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];

      const pools = [
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      const approveTx =
        await contract.populateTransaction.approveToken(DAI, [
          CURVE_SWAP,
        ]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx =
        await contract.populateTransaction.exchangeMultiple(
          amount,
          minimumReceived,
          routes,
          swapParams,
          pools,
          account.address,
        );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        swapTx.data,
      ]);

      expect(await usdc.balanceOf(account.address)).to.be.gte(
        usdcBalanceBefore.add(minimumReceived),
      );
    });

    it('Should exchange EURS for DAI', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 2n; // of EURS
      const minimumReceived = 40n * 10n ** 18n; // of DAI

      const { permit, signature } = await sign(
        {
          amount,
          token: EURS,
        },
        contract.address,
      );

      const routes = [
        EURS,
        '0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b', // eursusd
        USDC,
        '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7', // 3pool
        DAI,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const swapParams = [
        [1, 0, 3],
        [1, 0, 1],
        [0, 0, 0],
        [0, 0, 0],
      ];

      const pools = [
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const daiBalanceBefore = await dai.balanceOf(account.address);

      const approveTx =
        await contract.populateTransaction.approveToken(EURS, [
          CURVE_SWAP,
        ]);
      const permitTx =
        await contract.populateTransaction.permitTransferFrom(
          permit,
          signature,
        );
      const swapTx =
        await contract.populateTransaction.exchangeMultiple(
          amount,
          minimumReceived,
          routes,
          swapParams,
          pools,
          account.address,
        );

      await contract.multicall([
        approveTx.data,
        permitTx.data,
        swapTx.data,
      ]);

      expect(await dai.balanceOf(account.address)).to.be.gte(
        daiBalanceBefore.add(minimumReceived),
      );
    });

    it('Should exchange ETH for EURS (using multiple_exchange)', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 100n;
      const amount = 1n * 10n ** 18n; // of ETH
      const minimumReceived = 1000n * 10n ** 2n; // of EURS

      const routes = [
        ETH,
        '0xd51a44d3fae010294c616388b506acda1bfaae46', // tricrypto2
        USDT,
        '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7', // 3pool
        USDC,
        '0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b', // eursusd
        EURS,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const swapParams = [
        [2, 0, 3],
        [2, 1, 1],
        [0, 1, 3],
        [0, 0, 0],
      ];

      const pools = [
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const eursBalanceBefore = await eurs.balanceOf(account.address);

      const swapTx =
        await contract.populateTransaction.exchangeMultipleETH(
          amount,
          minimumReceived,
          routes,
          swapParams,
          pools,
          account.address,
          proxyFee,
        );

      await contract.multicall([swapTx.data], {
        value: amount + proxyFee,
      });

      expect(await eurs.balanceOf(account.address)).to.be.gte(
        eursBalanceBefore.add(minimumReceived),
      );
    });

    it('Should exchange ETH for FRAX (using multiple_exchange)', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 1000n;
      const amount = 5n * 10n ** 18n;
      const minimumReceived = 6000n * 10n * 18n;

      const routes = [
        ETH,
        '0xd51a44d3fae010294c616388b506acda1bfaae46', // tricrypto2
        USDT,
        '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7', // 3pool
        USDC,
        '0xdcef968d416a41cdac0ed8702fac8128a64241a2', // fraxusdc
        FRAX,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const swapParams = [
        [2, 0, 3],
        [2, 1, 1],
        [1, 0, 1],
        [0, 0, 0],
      ];

      const pools = [
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const fraxBalanceBefore = await frax.balanceOf(account.address);

      const swapTx =
        await contract.populateTransaction.exchangeMultipleETH(
          amount,
          minimumReceived,
          routes,
          swapParams,
          pools,
          account.address,
          proxyFee,
        );

      await contract.multicall([swapTx.data], {
        value: amount + proxyFee,
      });

      expect(await frax.balanceOf(account.address)).to.be.gte(
        fraxBalanceBefore.add(minimumReceived),
      );
    });

    it('Should exchange ETH for renBTC (using multiple_exchange)', async () => {
      const { contract } = await loadFixture(deploy);

      const proxyFee = 1000n;
      const amount = 1n * 10n ** 18n;
      const minimumReceived = 0n;

      const routes = [
        ETH,
        '0xd51a44d3fae010294c616388b506acda1bfaae46', // tricrypto2
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
        '0x93054188d876f558f4a66B2EF1d97d16eDf0895B', // tricrypto2
        REN_BTC,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const swapParams = [
        [2, 1, 3],
        [1, 0, 1],
        [0, 0, 0],
        [0, 0, 0],
      ];

      const pools = [
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ];

      const renBalanceBefore = await renBtc.balanceOf(
        account.address,
      );

      const swapTx =
        await contract.populateTransaction.exchangeMultipleETH(
          amount,
          minimumReceived,
          routes,
          swapParams,
          pools,
          account.address,
          proxyFee,
        );

      await contract.multicall([swapTx.data], {
        value: amount + proxyFee,
      });

      expect(await renBtc.balanceOf(account.address)).to.be.gte(
        renBalanceBefore.add(minimumReceived),
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
