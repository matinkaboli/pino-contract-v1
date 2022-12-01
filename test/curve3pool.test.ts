// Curve2pool
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const CRV = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const USDC = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
const USDT = "0xDAC17F958D2EE523A2206206994597C13D831EC7";
const POOL = "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7";
const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const amount = 1000n * 10n ** 6n; // $1000
const daiAmount = 1000n * 10n ** 18n; // $1000

describe("Curve 3 Pool", () => {
  let crv: IERC20;
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const Curve2Token = await ethers.getContractFactory("Curve3Token");
    const curve2Token = await Curve2Token.connect(accounts[0]).deploy(
      POOL,
      [DAI, USDC, USDT],
      CRV,
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

    crv = await ethers.getContractAt("IERC20", DAI);
    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);
    usdt = await ethers.getContractAt("IERC20", USDT);

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);

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

  it("Should add liquidity for 2 tokens", async () => {
    const curve = await loadFixture(deploy);

    const hundred = 100n * 10n ** 6n;
    const expectedLiquidity = 1000n * 10n ** 18n;

    await usdc.connect(accounts[0]).approve(curve.address, hundred);
    await usdt.connect(accounts[0]).approve(curve.address, hundred);

    const amounts = [0n, hundred, hundred];

    await curve.connect(accounts[0]).addLiquidity(amounts, 0, {
      value: 100,
    });
    // 266649
  });

  it("Should exchange USDT for USDC", async () => {
    const curve = await loadFixture(deploy);

    const exchangeAmount = 50n * 10n ** 6n;

    const usdtBefore = await usdt.balanceOf(accounts[0].address);

    await usdc.connect(accounts[0]).approve(curve.address, exchangeAmount);
    await curve.exchange(1, 2, exchangeAmount, 0);
    // 148401

    const usdtAfter = await usdt.balanceOf(accounts[0].address);

    expect(usdtAfter).to.be.gte(usdtBefore);
  });
});
