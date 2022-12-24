// Curve3pool
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { DAI, USDC, USDT } from "../utils/addresses";

// Using 3pool (DAI - USDC - USDT)
const POOL = "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7";
const POOL_TOKEN = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";

describe("Curve3Pool (DAI - USDC - USDT)", () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let poolToken: IERC20;
  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const Curve3Token = await ethers.getContractFactory("Curve3Token");
    const curve3Token = await Curve3Token.connect(accounts[0]).deploy(
      POOL,
      [DAI, USDC, USDT],
      POOL_TOKEN,
      100,
      {
        gasLimit: 5_000_000,
      }
    );

    return curve3Token;
  };

  before(async () => {
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE],
    });

    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);
    usdt = await ethers.getContractAt("IERC20", USDT);
    poolToken = await ethers.getContractAt("IERC20", POOL_TOKEN);

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);

    const amount = 1000n * 10n ** 6n; // $1000
    const daiAmount = 1000n * 10n ** 18n; // $1000

    await usdc.connect(whale).transfer(accounts[0].address, amount);
    await usdt.connect(whale).transfer(accounts[0].address, amount);
    await dai.connect(whale).transfer(accounts[0].address, daiAmount);

    const usdcBalance = await usdc.balanceOf(accounts[0].address);
    const usdtBalance = await usdt.balanceOf(accounts[0].address);
    const daiBalance = await dai.balanceOf(accounts[0].address);

    expect(usdtBalance).to.gte(amount);
    expect(usdcBalance).to.gte(amount);
    expect(daiBalance).to.gte(daiAmount);
  });

  describe("Add Liquidity", () => {
    it("Adds liquidity only for USDC", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, hundredUsdc, 0], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity only for DAI", async () => {
      const curve = await loadFixture(deploy);

      const hundredDai = 100n * 10n ** 18n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await dai.connect(accounts[0]).approve(curve.address, hundredDai);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredDai, 0, 0], 0, 100, {
          value: 100,
        });
      // gasUsed: 215k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity only for USDT", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdt = 100n * 10n ** 6n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, 0, hundredUsdt], 0, 100, {
          value: 100,
        });
      // gasUsed: 228k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity for 2 tokens: DAI - USDC", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredDai = 100n * 10n ** 18n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await dai.connect(accounts[0]).approve(curve.address, hundredDai);
      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredDai, hundredUsdc, 0], 0, 100, {
          value: 100,
        });
      // gasUsed: 276k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity for 2 tokens: DAI - USDT", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdt = 100n * 10n ** 6n;
      const hundredDai = 100n * 10n ** 18n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await dai.connect(accounts[0]).approve(curve.address, hundredDai);
      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredDai, 0, hundredUsdt], 0, 100, {
          value: 100,
        });
      // gasUsed: 272k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity for 2 tokens: USDC - USDT", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredUsdt = 100n * 10n ** 6n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);
      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, hundredUsdc, hundredUsdt], 0, 100, {
          value: 100,
        });
      // gasUsed: 288k
    });

    it("Adds liquidity for 3 tokens: DAI - USDC - USDT", async () => {
      const curve = await loadFixture(deploy);

      const hundredDai = 100n * 10n ** 18n;
      const hundredUsdc = 100n * 10n ** 6n;
      const hundredUsdt = 100n * 10n ** 6n;

      await dai.connect(accounts[0]).approve(curve.address, hundredDai);
      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);
      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredDai, hundredUsdc, hundredUsdt], 0, 100, {
          value: 100,
        });
      // gasUsed: 332k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });
  });

  describe("Remove Liquidity", () => {
    it("Should add_liquidity for 2 tokens and remove_liquidity", async () => {
      const curve = await loadFixture(deploy);

      const hundredDai = 100n * 10n ** 2n;
      const hundredUsdc = 100n * 10n ** 6n;

      await dai.connect(accounts[0]).approve(curve.address, hundredDai);
      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredDai, hundredUsdc, 0], 0, 100, {
          value: 100,
        });
      // gasUsed: 332k

      const poolBalance = await poolToken.balanceOf(accounts[0].address);

      expect(poolBalance).to.be.gte(1n * 10n ** 18n);

      await poolToken.connect(accounts[0]).approve(curve.address, poolBalance);

      const daiBalanceBefore = await dai.balanceOf(accounts[0].address);
      const usdcBalanceBefore = await usdc.balanceOf(accounts[0].address);

      await curve
        .connect(accounts[0])
        .removeLiquidity(poolBalance, [1000, 100000, 0], {
          value: 10000,
          gasLimit: 5_000_000,
        });
      // gasUsed: 209k

      const daiBalanceAfter = await dai.balanceOf(accounts[0].address);
      const usdcBalanceAfter = await usdc.balanceOf(accounts[0].address);

      expect(usdcBalanceAfter).to.be.gt(usdcBalanceBefore);
      expect(daiBalanceAfter).to.be.gt(daiBalanceBefore);
    });

    it("Should add_liquidity for 2 tokens and remove_one_coin", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredUsdt = 100n * 10n ** 6n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);
      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, hundredUsdc, hundredUsdt], 0, 100, {
          value: 100,
        });

      const poolBalance = await poolToken.balanceOf(accounts[0].address);

      expect(poolBalance).to.be.gte(1n * 10n ** 18n);

      await poolToken.connect(accounts[0]).approve(curve.address, poolBalance);

      const daiBalanceBefore = await dai.balanceOf(accounts[0].address);

      await curve
        .connect(accounts[0])
        .removeLiquidityOneCoinI(poolBalance, 0, 0, {
          value: 10000000,
          gasLimit: 5_000_000,
        });
      // gasUsed: 234k

      const daiBalanceAfter = await dai.balanceOf(accounts[0].address);

      expect(daiBalanceAfter).to.be.gte(daiBalanceBefore);
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
