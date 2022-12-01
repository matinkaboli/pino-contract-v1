// Curve2pool
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const SWAP = "0x55b916ce078ea594c10a874ba67ecc3d62e29822";
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const USDC = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
const USDT = "0xDAC17F958D2EE523A2206206994597C13D831EC7";
const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";

const amount = 1000n * 10n ** 6n; // $1000
const daiAmount = 1000n * 10n ** 18n; // $1000

describe("CurveSwap", () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const Curve2Token = await ethers.getContractFactory("CurveSwap");

    const curve2Token = await Curve2Token.connect(accounts[0]).deploy(SWAP, {
      gasLimit: 2_000_000,
    });

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

  it("Should exchange USDT for USDC", async () => {
    const curve = await loadFixture(deploy);

    const exchangeAmount = 50n * 10n ** 6n;

    await usdc.connect(accounts[0]).approve(curve.address, exchangeAmount);

    await curve.exchange(USDC, DAI, exchangeAmount, 0);
    // 1979935

    const daiBalance = await dai.balanceOf(accounts[0].address);

    console.log(daiBalance);

    expect(daiBalance).to.be.gte(daiAmount);
  });
});
