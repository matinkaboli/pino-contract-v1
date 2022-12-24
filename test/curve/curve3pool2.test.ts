// Curve3pool
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import wethInterface from "../utils/wethInterface.json";
import { USDT, WBTC, WETH } from "../utils/addresses";

// Using tricrypto2 (USDT - WBTC - ETH)
const POOL = "0xd51a44d3fae010294c616388b506acda1bfaae46";
const POOL_TOKEN = "0xc4ad29ba4b3c580e6d59105fff484999997675ff";
const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const WBTC_WHALE = "0x845cbcb8230197f733b59cfe1795f282786f212c";

describe("Curve3Pool (USDT, WBTC, ETH)", () => {
  let usdt: IERC20;
  let wbtc: IERC20;
  let weth: Contract;
  let poolToken: IERC20;
  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const Curve3Token = await ethers.getContractFactory("Curve3Token");
    const curve3Token = await Curve3Token.connect(accounts[0]).deploy(
      POOL,
      [USDT, WBTC, WETH],
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
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WBTC_WHALE],
    });

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);
    const wbtcWhale = await ethers.getSigner(WBTC_WHALE);

    weth = new ethers.Contract(WETH, wethInterface, whale);
    usdt = await ethers.getContractAt("IERC20", USDT);
    wbtc = await ethers.getContractAt("IERC20", WBTC);
    poolToken = await ethers.getContractAt("IERC20", POOL_TOKEN);

    const usdtAmount = 1000n * 10n ** 6n;
    const wbtcAmount = 1000n * 10n ** 8n;
    const ethAmount = 1000n * 10n ** 18n;

    await usdt.connect(whale).transfer(accounts[0].address, usdtAmount);
    await wbtc.connect(wbtcWhale).transfer(accounts[0].address, wbtcAmount);
    await weth.connect(accounts[0]).deposit({
      value: ethAmount,
    });

    const usdtBalance = await usdt.balanceOf(accounts[0].address);
    const wbtcBalance = await wbtc.balanceOf(accounts[0].address);
    const wethBalance = await weth.balanceOf(accounts[0].address);

    expect(usdtBalance).to.gte(usdtBalance);
    expect(wbtcBalance).to.gte(wbtcAmount);
    expect(wethBalance).to.gte(ethAmount);
  });

  describe("Add Liquidity", () => {
    it("Adds liquidity only for USDT", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdt = 100n * 10n ** 6n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredUsdt, 0, 0], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity only for WBTC", async () => {
      const curve = await loadFixture(deploy);

      const hundredWbtc = 100n * 10n ** 8n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await wbtc.connect(accounts[0]).approve(curve.address, hundredWbtc);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, hundredWbtc, 0], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity only for WETH", async () => {
      const curve = await loadFixture(deploy);

      const hundredWeth = 100n * 10n ** 18n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await weth.connect(accounts[0]).approve(curve.address, hundredWeth);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, 0, hundredWeth], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity for USDT + WBTC", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdt = 100n * 10n ** 6n;
      const hundredWbtc = 100n * 10n ** 8n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);
      await wbtc.connect(accounts[0]).approve(curve.address, hundredWbtc);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredUsdt, hundredWbtc, 0], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity for USDT + WETH", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdt = 100n * 10n ** 6n;
      const hundredWeth = 100n * 10n ** 18n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);
      await weth.connect(accounts[0]).approve(curve.address, hundredWeth);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredUsdt, 0, hundredWeth], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity for WBTC + WETH", async () => {
      const curve = await loadFixture(deploy);

      const hundredWbtc = 100n * 10n ** 8n;
      const hundredWeth = 100n * 10n ** 18n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await wbtc.connect(accounts[0]).approve(curve.address, hundredWbtc);
      await weth.connect(accounts[0]).approve(curve.address, hundredWeth);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, hundredWbtc, hundredWeth], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity for USDT + WBTC + WETH", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdt = 100n * 10n ** 6n;
      const hundredWbtc = 100n * 10n ** 8n;
      const hundredWeth = 100n * 10n ** 18n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await usdt.connect(accounts[0]).approve(curve.address, hundredUsdt);
      await wbtc.connect(accounts[0]).approve(curve.address, hundredWbtc);
      await weth.connect(accounts[0]).approve(curve.address, hundredWeth);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredUsdt, hundredWbtc, hundredWeth], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });
  });

  describe("Remove Liquidity", () => {
    it("Should add liquidity and remove liquidity", async () => {
      const curve = await loadFixture(deploy);

      const hundredWbtc = 100n * 10n ** 8n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await wbtc.connect(accounts[0]).approve(curve.address, hundredWbtc);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, hundredWbtc, 0], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);

      await poolToken
        .connect(accounts[0])
        .approve(curve.address, poolTokenBalanceAfter);

      const usdtBalanceBefore = await usdt.balanceOf(accounts[0].address);
      const wbtcBalanceBefore = await wbtc.balanceOf(accounts[0].address);
      const wethBalanceBefore = await weth.balanceOf(accounts[0].address);

      await curve
        .connect(accounts[0])
        .removeLiquidity(poolTokenBalanceAfter, [0, 0, 0]);

      const usdtBalanceAfter = await usdt.balanceOf(accounts[0].address);
      const wbtcBalanceAfter = await wbtc.balanceOf(accounts[0].address);
      const wethBalanceAfter = await weth.balanceOf(accounts[0].address);

      expect(usdtBalanceAfter).to.gt(usdtBalanceBefore);
      expect(wbtcBalanceAfter).to.gt(wbtcBalanceBefore);
      expect(wethBalanceAfter).to.gt(wethBalanceBefore);
    });

    it("Should add liquidity and remove liquidity one coin", async () => {
      const curve = await loadFixture(deploy);

      const hundredWbtc = 100n * 10n ** 8n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await wbtc.connect(accounts[0]).approve(curve.address, hundredWbtc);

      await curve
        .connect(accounts[0])
        .addLiquidity([0, hundredWbtc, 0], 0, 100, {
          value: 100,
        });
      // gasUsed: 232k

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);

      await poolToken
        .connect(accounts[0])
        .approve(curve.address, poolTokenBalanceAfter);

      const usdtBalanceBefore = await usdt.balanceOf(accounts[0].address);

      await curve
        .connect(accounts[0])
        .removeLiquidityOneCoinU(poolTokenBalanceAfter, 2, 0);

      const usdtBalanceAfter = await usdt.balanceOf(accounts[0].address);

      expect(usdtBalanceAfter).to.gt(usdtBalanceBefore);
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
