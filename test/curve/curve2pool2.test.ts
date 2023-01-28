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

// Using (ETH - sETH)
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const SETH = "0x5e74c9036fb86bd7ecdcb084a0673efc32ea31cb";
const POOL = "0xc5424b857f758e906013f3555dad202e4bdb4567";
const POOL_TOKEN = "0xa3d87fffce63b53e0d54faa1cc983b7eb0b74a9c";
const WHALE = "0xa97bc5dd7b32003398645edeb2178c91087f86d8";

describe("Curve2Pool (ETH - sETH)", () => {
  let chainId: number;
  let seth: IERC20;
  let poolToken: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Curve2Token = await ethers.getContractFactory("Curve2Token");
    const curve2Token = await Curve2Token.deploy(
      POOL,
      PERMIT2_ADDRESS,
      [ETH, SETH],
      POOL_TOKEN,
      0
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

    [account] = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);

    seth = await ethers.getContractAt("IERC20", SETH);
    poolToken = await ethers.getContractAt("IERC20", POOL_TOKEN);

    const amount = 100n * 10n ** 18n;

    await seth.connect(whale).transfer(account.address, amount);

    expect(await seth.balanceOf(account.address)).to.gte(amount);

    await seth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await poolToken.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe("Adding Liquidity", () => {
    it("Should add SETH as liquidity", async () => {
      const curve = await loadFixture(deploy);

      const fee = 5;
      const amount = 10n * 10n ** 18n;
      const minAmount = 8n * 10n ** 18n;

      const amounts = [0n, amount];

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: SETH,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, amounts, minAmount, fee, {
        value: fee,
      });
      // gasUsed: 324k

      expect(await poolToken.balanceOf(account.address)).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );
    });

    it("Should add ETH as liquidity", async () => {
      const curve = await loadFixture(deploy);

      const fee = 5n;
      const amount = 10n * 10n ** 18n;
      const minAmount = 8n * 10n ** 18n;

      const amounts = [amount, 0n];

      const { permit, signature } = await multiSign([], curve.address);

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, amounts, minAmount, fee, {
        value: amount + fee,
      });
      // gasUed: 167k

      expect(await poolToken.balanceOf(account.address)).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );
    });

    it("Should add ETH & sETH as liquidity", async () => {
      const curve = await loadFixture(deploy);

      const fee = 5n;
      const amount = 10n * 10n ** 18n;
      const minAmount = 16n * 10n ** 18n;

      const amounts = [amount, amount];

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: SETH,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, amounts, minAmount, fee, {
        value: amount + fee,
      });
      // gasUed: 331k

      expect(await poolToken.balanceOf(account.address)).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );
    });
  });

  describe("Remove Liquidity", () => {
    it("Should add_liquidity for SETH and remove_one_coin", async () => {
      const curve = await loadFixture(deploy);

      const fee = 0n;
      const amount = 10n * 10n ** 18n;
      const minAmount = 8n * 10n ** 18n;

      const amounts = [0n, amount];

      const { permit: permit1, signature: signature1 } = await multiSign(
        [
          {
            amount,
            token: SETH,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit1, signature1, amounts, minAmount, fee);
      // gasUsed: 324k

      const poolTokenBalanceAfter = await poolToken.balanceOf(account.address);

      expect(poolTokenBalanceAfter).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolTokenBalanceAfter,
        },
        curve.address
      );

      const sethBalanceBefore = await seth.balanceOf(account.address);

      await curve.removeLiquidityOneCoinI(permit2, signature2, 1, 0);
      // gasUsed: 297k

      expect(await seth.balanceOf(account.address)).to.gt(sethBalanceBefore);
    });

    it("Should add_liquidity for ETH token and remove_one_coin", async () => {
      const curve = await loadFixture(deploy);

      const fee = 5n;
      const amount = 10n * 10n ** 18n;
      const minAmount = 8n * 10n ** 18n;

      const amounts = [amount, 0n];

      const { permit: permit1, signature: signature1 } = await multiSign(
        [],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit1, signature1, amounts, minAmount, fee, {
        value: amount + fee,
      });
      // gasUsed: 167k

      const poolTokenBalanceAfter = await poolToken.balanceOf(account.address);

      expect(poolTokenBalanceAfter).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolTokenBalanceAfter,
        },
        curve.address
      );

      const ethBalanceBefore = await account.getBalance();

      await curve.removeLiquidityOneCoinI(permit2, signature2, 0, 0);
      // gasUsed: 151k

      expect(await account.getBalance()).to.gt(ethBalanceBefore);
    });

    it("Should add_liquidity for 2 tokens and remove_liquidity", async () => {
      const curve = await loadFixture(deploy);

      const fee = 5n;
      const amount = 10n * 10n ** 18n;
      const minAmount = 0;

      const amounts = [amount, amount];

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      const { permit: permit1, signature: signature1 } = await multiSign(
        [
          {
            amount,
            token: SETH,
          },
        ],
        curve.address
      );

      await curve.addLiquidity(permit1, signature1, amounts, minAmount, fee, {
        value: amount + fee,
      });
      // gasUed: 331k

      const poolTokenBalanceAfter = await poolToken.balanceOf(account.address);

      expect(poolTokenBalanceAfter).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );

      const sethBalanceBefore = await seth.balanceOf(account.address);

      const removeLiquidityAmount = poolTokenBalanceAfter.sub(
        poolTokenBalanceBefore
      );

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: removeLiquidityAmount,
        },
        curve.address
      );

      await curve.removeLiquidity(permit2, signature2, [0, minAmount]);
      // gasUsed: 287k

      expect(await seth.balanceOf(account.address)).to.gt(
        sethBalanceBefore.add(minAmount)
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
