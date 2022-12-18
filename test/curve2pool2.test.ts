// Curve2pool
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Using (ETH - sETH)
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const SETH = "0x5e74c9036fb86bd7ecdcb084a0673efc32ea31cb";
const POOL = "0xc5424b857f758e906013f3555dad202e4bdb4567";
const POOL_TOKEN = "0xa3d87fffce63b53e0d54faa1cc983b7eb0b74a9c";
const WHALE = "0xa97bc5dd7b32003398645edeb2178c91087f86d8";

describe("Curve2Pool (ETH - sETH)", () => {
  let seth: IERC20;
  let poolToken: IERC20;
  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const Curve2Token = await ethers.getContractFactory("Curve2TokenI");
    const curve2Token = await Curve2Token.connect(accounts[0]).deploy(
      POOL,
      [ETH, SETH],
      POOL_TOKEN,
      0,
      {
        gasLimit: 5_000_000,
      }
    );

    return curve2Token;
  };

  before(async () => {
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE],
    });

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);

    seth = await ethers.getContractAt("IERC20", SETH);
    poolToken = await ethers.getContractAt("IERC20", POOL_TOKEN);

    const amount = 100n * 10n ** 18n;

    await seth.connect(whale).transfer(accounts[0].address, amount);

    const sethBalance = await seth.balanceOf(accounts[0].address);

    expect(sethBalance).to.gte(amount);
  });

  describe("Adding Liquidity", () => {
    it("Should add SETH as liquidity", async () => {
      const curve = await loadFixture(deploy);

      const fee = 300000;
      const amount = 10n * 10n ** 18n;
      const minAmount = 8n * 10n ** 18n;

      const amounts = [0n, amount];

      await seth.connect(accounts[0]).approve(curve.address, amount);

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve.addLiquidity(amounts, minAmount, fee, {
        value: fee,
      });
      // gasUsed: 292k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );
    });

    it("Should add ETH as liquidity", async () => {
      const curve = await loadFixture(deploy);

      const fee = 20000n;
      const amount = 10n * 10n ** 18n;
      const minAmount = 8n * 10n ** 18n;

      const amounts = [amount, 0n];

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve.addLiquidity(amounts, minAmount, fee, {
        value: amount + fee,
      });
      // gasUed: 139k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );
    });

    it("Should add ETH & sETH as liquidity", async () => {
      const curve = await loadFixture(deploy);

      const fee = 350000n;
      const amount = 10n * 10n ** 18n;
      const minAmount = 16n * 10n ** 18n;

      const amounts = [amount, amount];

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await seth.connect(accounts[0]).approve(curve.address, amount);

      await curve.addLiquidity(amounts, minAmount, fee, {
        value: amount + fee,
      });
      // gasUed: 299k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.gt(
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

      await seth.connect(accounts[0]).approve(curve.address, amount);

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve.addLiquidity(amounts, minAmount, fee);
      // gasUsed: 292k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );

      await poolToken
        .connect(accounts[0])
        .approve(curve.address, poolTokenBalanceAfter);

      const sethBalanceBefore = await seth.balanceOf(accounts[0].address);

      await curve.removeLiquidityOneCoin(poolTokenBalanceAfter, 1, 0, {
        gasLimit: 3000000,
      });
      // gasUsed: 265k

      const sethBalanceAfter = await seth.balanceOf(accounts[0].address);

      expect(sethBalanceAfter).to.gt(sethBalanceBefore);
    });

    it("Should add_liquidity for ETH token and remove_one_coin", async () => {
      const curve = await loadFixture(deploy);

      const fee = 300000n;
      const amount = 10n * 10n ** 18n;
      const minAmount = 8n * 10n ** 18n;

      const amounts = [amount, 0n];

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve.addLiquidity(amounts, minAmount, fee, {
        value: amount + fee,
      });
      // gasUsed: 140k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );

      await poolToken
        .connect(accounts[0])
        .approve(curve.address, poolTokenBalanceAfter);

      const ethBalanceBefore = await ethers.provider.getBalance(
        accounts[0].address
      );

      await curve.removeLiquidityOneCoin(poolTokenBalanceAfter, 0, 0, {
        gasLimit: 3000000,
      });
      // gasUsed: 126k

      const ethBalanceAfter = await ethers.provider.getBalance(
        accounts[0].address
      );

      expect(ethBalanceAfter).to.gt(ethBalanceBefore);
    });

    it("Should add_liquidity for 2 tokens and remove_liquidity", async () => {
      const curve = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 18n;
      const minAmount = 0;
      // const minAmount = 16n * 10n ** 18n;

      const amounts = [amount, amount];

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await seth.connect(accounts[0]).approve(curve.address, amount);

      await curve.addLiquidity(amounts, minAmount, fee, {
        value: amount + fee,
      });
      // gasUed: 298k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.gt(
        poolTokenBalanceBefore.add(minAmount)
      );

      const sethBalanceBefore = await seth.balanceOf(accounts[0].address);

      const removeLiquidityAmount = poolTokenBalanceAfter.sub(
        poolTokenBalanceBefore
      );

      await poolToken
        .connect(accounts[0])
        .approve(curve.address, removeLiquidityAmount);

      await curve.removeLiquidity(removeLiquidityAmount, [0, minAmount]);
      // gasUsed: 256k

      const sethBalanceAfter = await seth.balanceOf(accounts[0].address);

      expect(sethBalanceAfter).to.gt(sethBalanceBefore.add(minAmount));
    });
  });

  describe("Admin", () => {
    it("Should withdraw money", async () => {
      const curve = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await accounts[0].sendTransaction({
        to: curve.address,
        value: amount,
      });

      const balanceBefore = await ethers.provider.getBalance(
        accounts[0].address
      );

      await curve.withdrawAdmin();

      const balanceAfter = await ethers.provider.getBalance(
        accounts[0].address
      );

      expect(balanceAfter).to.gt(balanceBefore);
    });
  });
});
