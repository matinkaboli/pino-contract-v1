// LendingPool
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { IERC20 } from "../../typechain-types";
import wethInterface from "../utils/wethInterface.json";
import {
  DAI,
  USDC,
  USDT,
  WETH,
  A_DAI,
  A_USDC,
  A_USDT,
  A_WETH,
  tokens,
  aTokens,
} from "../utils/addresses";
import { Contract } from "ethers";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const LENDING_POOL = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9";

describe("Aave - LendingPool", () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let aDai: IERC20;
  let aUsdc: IERC20;
  let aUsdt: IERC20;
  let aWeth: IERC20;
  let weth: Contract;
  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const lendingPool = await LendingPool.connect(accounts[0]).deploy(
      LENDING_POOL,
      [USDC, USDT],
      [A_USDC, A_USDT],
      {
        gasLimit: 10_000_000,
      }
    );

    return lendingPool;
  };

  before(async () => {
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE],
    });

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);

    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);
    usdt = await ethers.getContractAt("IERC20", USDT);
    aDai = await ethers.getContractAt("IERC20", A_DAI);
    aUsdc = await ethers.getContractAt("IERC20", A_USDC);
    aUsdt = await ethers.getContractAt("IERC20", A_USDT);
    aWeth = await ethers.getContractAt("IERC20", A_WETH);
    weth = new ethers.Contract(WETH, wethInterface, whale);

    const amount = 5000n * 10n ** 6n;
    const ethAmount = 1n * 10n ** 18n;
    const daiAmount = 5000n * 10n ** 18n;

    await usdc.connect(whale).transfer(accounts[0].address, amount);
    await usdt.connect(whale).transfer(accounts[0].address, amount);
    await dai.connect(whale).transfer(accounts[0].address, daiAmount);
    await weth.connect(accounts[0]).deposit({
      value: ethAmount,
    });

    const daiBalance = await dai.balanceOf(accounts[0].address);
    const usdcBalance = await usdc.balanceOf(accounts[0].address);
    const usdtBalance = await usdt.balanceOf(accounts[0].address);
    const wethBalance = await weth.balanceOf(accounts[0].address);

    expect(usdcBalance).to.gte(amount);
    expect(usdtBalance).to.gte(amount);
    expect(daiBalance).to.gte(daiAmount);
    expect(wethBalance).to.gte(ethAmount);
  });

  describe("Deployment", () => {
    it("Should deploy with 0 tokens", async () => {
      const LendingPool = await ethers.getContractFactory("LendingPool");

      await LendingPool.deploy(LENDING_POOL, [], []);
    });

    it("Should deploy with multiple tokens", async () => {
      const LendingPool = await ethers.getContractFactory("LendingPool");

      await LendingPool.deploy(LENDING_POOL, [DAI, USDC], [A_DAI, A_USDC]);
    });

    it.skip("Should deploy with all aave tokens and aTokens", async () => {
      const LendingPool = await ethers.getContractFactory("LendingPool");

      await LendingPool.deploy(LENDING_POOL, tokens, aTokens, {
        gasLimit: 10_000_000,
      });
    });
  });

  describe("Supply", async () => {
    it("Should supply USDC", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;

      await usdc.connect(accounts[0]).approve(lendingPool.address, amount);

      const aUsdcBalanceBefore = await aUsdc.balanceOf(accounts[0].address);

      await lendingPool.deposit(usdc.address, amount);
      // gasUsed: 306k

      const aUsdcBalanceAfter = await aUsdc.balanceOf(accounts[0].address);

      expect(aUsdcBalanceAfter).to.gt(aUsdcBalanceBefore);
    });

    it("Should supply DAI", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      await dai.connect(accounts[0]).approve(lendingPool.address, amount);

      const aDaiBalanceBefore = await aDai.balanceOf(accounts[0].address);

      await lendingPool.deposit(dai.address, amount);
      // gasUsed: 308k

      const aDaiBalanceAfter = await aDai.balanceOf(accounts[0].address);

      expect(aDaiBalanceAfter).to.gt(aDaiBalanceBefore);
    });

    it("Should supply WETH", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      await weth.connect(accounts[0]).approve(lendingPool.address, amount);

      const aWethBalanceBefore = await aWeth.balanceOf(accounts[0].address);

      await lendingPool.deposit(weth.address, amount);
      // gasUsed: 303k

      const aWethBalanceAfter = await aWeth.balanceOf(accounts[0].address);

      expect(aWethBalanceAfter).to.gt(aWethBalanceBefore);
    });

    it("Should supply USDT", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 10n * 10n ** 6n;
      const amount2 = 9n * 10n ** 6n;

      await usdt.connect(accounts[0]).approve(lendingPool.address, amount);

      const aUsdtBalanceBefore = await aUsdt.balanceOf(accounts[0].address);

      await lendingPool.deposit(usdt.address, amount2);
      // gasUsed: 303k

      const aUsdtBalanceAfter = await aUsdt.balanceOf(accounts[0].address);

      expect(aUsdtBalanceAfter).to.gt(aUsdtBalanceBefore);
    });
  });

  describe("Admin", () => {
    it("Should change lending pool address", async () => {
      const lendingPool = await loadFixture(deploy);

      const newLendingPoolAddress =
        "0xc6845a5c768bf8d7681249f8927877efda425baf";

      await lendingPool
        .connect(accounts[0])
        .changeAaveAddress(
          newLendingPoolAddress,
          [USDC, USDT],
          [A_USDC, A_USDT]
        );

      const currentOwner = await lendingPool.aave();

      expect(currentOwner).to.hexEqual(newLendingPoolAddress);
    });

    it("Should withdraw money", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await accounts[0].sendTransaction({
        to: lendingPool.address,
        value: amount,
      });

      const balanceBefore = await ethers.provider.getBalance(
        accounts[0].address
      );

      await lendingPool.withdrawAdmin();

      const balanceAfter = await ethers.provider.getBalance(
        accounts[0].address
      );

      expect(balanceAfter).to.gt(balanceBefore);
    });
  });
});
