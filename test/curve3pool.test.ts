// Curve2pool
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const USDC = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
const USDT = "0xDAC17F958D2EE523A2206206994597C13D831EC7";
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
    const Curve2Token = await ethers.getContractFactory("Curve3Token");
    const curve2Token = await Curve2Token.connect(accounts[0]).deploy(
      POOL,
      [DAI, USDC, USDT],
      POOL_TOKEN,
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

    expect(usdtBalance).to.equal(amount);
    expect(usdcBalance).to.equal(amount);
    expect(daiBalance).to.equal(daiAmount);
  });

  describe("Add Liquidity", () => {
    it("Adds liquidity only for USDC", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);

      await curve.connect(accounts[0]).addLiquidity([0, hundredUsdc, 0], 0, {
        value: 100,
      });
      // gasUsed: 232k
    });

    it("Adds liquidity only for DAI", async () => {
      const curve = await loadFixture(deploy);

      const hundredDai = 100n * 10n ** 18n;

      await dai.connect(accounts[0]).approve(curve.address, hundredDai);

      await curve.connect(accounts[0]).addLiquidity([hundredDai, 0, 0], 0, {
        value: 100,
      });
      // gasUsed: 215k
    });

    it("Adds liquidity only for USDT", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdt = 100n * 10n ** 6n;

      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);

      await curve.connect(accounts[0]).addLiquidity([0, 0, hundredUsdt], 0, {
        value: 100,
      });
      // gasUsed: 228k
    });

    it("Adds liquidity for 2 tokens: DAI - USDC", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredDai = 100n * 10n ** 18n;

      await dai.connect(accounts[0]).approve(curve.address, hundredDai);
      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredDai, hundredUsdc, 0], 0, {
          value: 100,
        });
      // gasUsed: 276k
    });

    it("Adds liquidity for 2 tokens: DAI - USDT", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdt = 100n * 10n ** 6n;
      const hundredDai = 100n * 10n ** 18n;

      await dai.connect(accounts[0]).approve(curve.address, hundredDai);
      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredDai, 0, hundredUsdt], 0, {
          value: 100,
        });
      // gasUsed: 272k
    });

    it("Adds liquidity for 2 tokens: USDC - USDT", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredUsdt = 100n * 10n ** 6n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);
      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, hundredUsdc, hundredUsdt], 0, {
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

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredDai, hundredUsdc, hundredUsdt], 0, {
          value: 100,
        });
      // gasUsed: 332k
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
        .addLiquidity([hundredDai, hundredUsdc, 0], 0, {
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
        .addLiquidity([0, hundredUsdc, hundredUsdt], 0, {
          value: 100,
        });

      const poolBalance = await poolToken.balanceOf(accounts[0].address);

      expect(poolBalance).to.be.gte(1n * 10n ** 18n);

      await poolToken.connect(accounts[0]).approve(curve.address, poolBalance);

      const daiBalanceBefore = await dai.balanceOf(accounts[0].address);

      await curve
        .connect(accounts[0])
        .removeLiquidityOneCoin(poolBalance, 0, 0, {
          value: 10000000,
          gasLimit: 5_000_000,
        });
      // gasUsed: 234k

      const daiBalanceAfter = await dai.balanceOf(accounts[0].address);

      expect(daiBalanceAfter).to.be.gte(daiBalanceBefore);
    });
  });

  describe("Admin actions", () => {
    it("Withdraws money", async () => {
      const curve = await loadFixture(deploy);

      // Pay some ETH first
      await usdc.connect(accounts[0]).approve(curve.address, 100);
      await curve.addLiquidity([0, 100, 0], 0, {
        value: 1n * 10n ** 18n,
      });

      const userBalanceBefore = await ethers.provider.getBalance(
        accounts[0].address
      );

      await ethers.provider.getBalance(curve.address);

      await curve.connect(accounts[0]).withdrawAdmin();

      const balanceAfterWithdrawal = await ethers.provider.getBalance(
        curve.address
      );

      expect(balanceAfterWithdrawal).to.equal(0);

      const userBalanceAfter = await ethers.provider.getBalance(
        accounts[0].address
      );

      expect(userBalanceAfter).to.gt(userBalanceBefore);
    });
  });
});
