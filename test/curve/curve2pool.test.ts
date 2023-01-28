// Curve2pool
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { constants } from "ethers";
import {
  PERMIT2_ADDRESS,
  TokenPermissions,
  SignatureTransfer,
  PermitBatchTransferFrom,
} from "@uniswap/permit2-sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { PermitTransferFrom } from "@uniswap/permit2-sdk/dist/PermitTransferFrom";
import { IERC20 } from "../typechain-types";
import { EURS, USDC } from "../utils/addresses";

const POOL = "0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b";
const POOL_TOKEN = "0x3d229e1b4faab62f621ef2f6a610961f7bd7b23b";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const EURS_WHALE = "0xcfb87039a1eda5428e2c8386d31ccf121835ecdb";

describe("Curve2Pool (USDC - EURS)", () => {
  let chainId: number;
  let usdc: IERC20;
  let eurs: IERC20;
  let poolToken: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Curve2Token = await ethers.getContractFactory("Curve2Token");
    const curve2Token = await Curve2Token.deploy(
      POOL,
      PERMIT2_ADDRESS,
      [USDC, EURS],
      POOL_TOKEN,
      100
    );

    return curve2Token;
  };

  const sign = async (permitted: TokenPermissions, spender: string) => {
    const permit: PermitTransferFrom = {
      permitted,
      spender,
      nonce: Math.floor(Math.random() * 5000),
      deadline: constants.MaxUint256,
    };

    const { domain, types, values } = SignatureTransfer.getPermitData(
      permit,
      PERMIT2_ADDRESS,
      chainId
    );

    const signature = await account._signTypedData(domain, types, values);

    return { permit, signature };
  };

  const multiSign = async (permitted: TokenPermissions[], spender: string) => {
    const permit: PermitBatchTransferFrom = {
      permitted,
      spender,
      nonce: Math.floor(Math.random() * 5000),
      deadline: constants.MaxUint256,
    };

    const { domain, types, values } = SignatureTransfer.getPermitData(
      permit,
      PERMIT2_ADDRESS,
      chainId
    );

    const signature = await account._signTypedData(domain, types, values);

    return { permit, signature };
  };

  before(async () => {
    const network = await ethers.provider.getNetwork();
    chainId = network.chainId;

    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE],
    });

    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [EURS_WHALE],
    });

    const whale = await ethers.getSigner(WHALE);
    const eursWhale = await ethers.getSigner(EURS_WHALE);

    usdc = await ethers.getContractAt("IERC20", USDC);
    eurs = await ethers.getContractAt("IERC20", EURS);
    poolToken = await ethers.getContractAt("IERC20", POOL_TOKEN);

    [account] = await ethers.getSigners();

    const usdcAmount = 1000n * 10n ** 6n;
    const eursAmount = 1000n * 10n ** 2n;

    await usdc.connect(whale).transfer(account.address, usdcAmount);
    await eurs.connect(eursWhale).transfer(account.address, eursAmount);

    const usdcBalance = await usdc.balanceOf(account.address);
    const eursBalance = await eurs.balanceOf(account.address);

    expect(usdcBalance).to.gte(usdcAmount);
    expect(eursBalance).to.gte(eursBalance);

    await usdc.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await eurs.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await poolToken
      .connect(account)
      .approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe("Add Liquidity", () => {
    it("Adds liquidity only for USDC", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: USDC,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, [amount, 0], 0, 100, {
        value: 1,
      });
      // gasUsed: 431k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity only for EURS", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 2n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: EURS,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, [0, amount], 0, 100, {
        value: 1,
      });
      // gasUsed: 429k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Should add_liquidity for both tokens", async () => {
      const curve = await loadFixture(deploy);

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
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, [amount1, amount2], 0, 100, {
        value: 1,
      });
      // gasUsed: 517k

      expect(await poolToken.balanceOf(account.address)).to.gt(
        poolTokenBalanceBefore
      );
    });
  });

  describe("Remove Liquidity", () => {
    it("Should add_liquidity for 2 tokens and remove_liquidity", async () => {
      const curve = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 2n;

      const { permit: permit1, signature: signature1 } = await multiSign(
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
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(
        permit1,
        signature1,
        [amount1, amount2],
        0,
        100,
        {
          value: 1,
        }
      );
      // gasUsed: 517k

      const poolTokenBalanceAfter = await poolToken.balanceOf(account.address);

      expect(poolTokenBalanceAfter).to.be.gte(poolTokenBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolTokenBalanceAfter,
        },
        curve.address
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);
      const eursBalanceBefore = await eurs.balanceOf(account.address);

      await curve.removeLiquidity(permit2, signature2, [0, 0], {
        value: 1,
      });
      // gasUsed: 230k

      expect(await usdc.balanceOf(account.address)).to.be.gt(usdcBalanceBefore);
      expect(await eurs.balanceOf(account.address)).to.be.gt(eursBalanceBefore);
    });

    it("Should add_liquidity for 2 tokens and remove_one_coin", async () => {
      const curve = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 2n;

      const { permit: permit1, signature: signature1 } = await multiSign(
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
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(
        permit1,
        signature1,
        [amount1, amount2],
        0,
        100,
        {
          value: 1,
        }
      );
      // gasUsed: 517k

      const poolTokenBalanceAfter = await poolToken.balanceOf(account.address);

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolTokenBalanceAfter,
        },
        curve.address
      );

      const eursBalanceBefore = await eurs.balanceOf(account.address);

      await curve.removeLiquidityOneCoinU(permit2, signature2, 0, 0, {
        value: 1,
      });
      // gasUsed: 230k

      expect(await eurs.balanceOf(account.address)).to.be.gte(
        eursBalanceBefore
      );
    });
  });

  describe("Admin", () => {
    it("Should withdraw money", async () => {
      const curve = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await account.sendTransaction({
        to: curve.address,
        value: amount,
      });

      const balanceBefore = await account.getBalance();

      await curve.withdrawAdmin();

      expect(await account.getBalance()).to.gt(balanceBefore);
    });
  });
});
