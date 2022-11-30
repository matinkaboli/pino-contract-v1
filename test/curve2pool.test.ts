// Curve2pool
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const USDC = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
const USDT = "0xDAC17F958D2EE523A2206206994597C13D831EC7";
const POOL = "0x1005f7406f32a61bd760cfa14accd2737913d546";
const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const amount = 1000n * 10n ** 6n; // $1000

describe("Curve 2 Pool", () => {
  let usdc: IERC20;
  let usdt: IERC20;
  let pool: IERC20;
  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const Curve2Token = await ethers.getContractFactory("Curve2Token");
    const curve2Token = await Curve2Token.connect(accounts[0]).deploy(
      POOL,
      [USDC, USDT],
      {
        gasLimit: 2_000_000,
      }
    );

    return curve2Token;
  };

  before(async () => {
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE],
    });

    usdc = await ethers.getContractAt("IERC20", USDC);
    usdt = await ethers.getContractAt("IERC20", USDT);
    pool = await ethers.getContractAt("IERC20", POOL);

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);

    await usdc.connect(whale).transfer(accounts[0].address, amount);
    await usdt.connect(whale).transfer(accounts[0].address, amount);

    const usdcBalance = await usdc.balanceOf(accounts[0].address);
    const usdtBalance = await usdt.balanceOf(accounts[0].address);

    expect(usdtBalance).to.equal(amount);
    expect(usdcBalance).to.equal(amount);
  });

  it("Should add liquidity for 2 tokens", async () => {
    const curve = await loadFixture(deploy);

    const hundred = 100n * 10n ** 6n;
    const expectedLiquidity = 199n * 10n ** 18n;

    await usdc.connect(accounts[0]).approve(curve.address, hundred);
    await usdt.connect(accounts[0]).approve(curve.address, hundred);

    await curve.connect(accounts[0]).addLiquidity([hundred, hundred], 0, {
      value: 100,
    });
    // 213504 without for loop
    // 213674 with for loop

    const poolBalance = await pool.balanceOf(accounts[0].address);

    expect(poolBalance).to.be.gte(expectedLiquidity);

    await pool.connect(accounts[0]).approve(curve.address, poolBalance);

    await curve
      .connect(accounts[0])
      .removeLiquidity(poolBalance, [hundred / 2n, 50000], {
        value: 100,
      });
    // 130166
  });

  it("Should exchange USDT for USDC", async () => {
    const curve = await loadFixture(deploy);

    const exchangeAmount = 50n * 10n ** 6n;

    const usdtBefore = await usdt.balanceOf(accounts[0].address);

    await usdc.connect(accounts[0]).approve(curve.address, exchangeAmount);
    await curve.exchange(0, 1, exchangeAmount, 0);
    // 148401

    const usdtAfter = await usdt.balanceOf(accounts[0].address);

    expect(usdtAfter).to.be.gte(usdtBefore);
  });
});
