// COMET
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const DAI = "0x6B175474E89094C44DA98B954EEDEAC495271D0F";
const USDC = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
const USDT = "0xDAC17F958D2EE523A2206206994597C13D831EC7";

const acc1 = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
const poolAddress = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

const abi = [
  "function calc_token_amount(uint256[3] amounts, bool deposit) view returns (uint256)",
  "function coins(uint256) view external returns (address)",
  "function remove_liquidity(uint256 _amount, uint256[3] min_amounts)",
  "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external",
  "function add_liquidity(uint256[3] amounts, uint256 min_mint_amount) external",
  "function get_dy(int128 i, int128 j, uint256 dx) view external returns (uint256)",
];

describe("Curve", () => {
  let vitalik: SignerWithAddress;
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;

  const pool3 = new ethers.Contract(poolAddress, abi);

  it("Should be 3 USD tokens", async () => {
    const token0 = await pool3.connect(vitalik).coins(0);
    const token1 = await pool3.connect(vitalik).coins(1);
    const token2 = await pool3.connect(vitalik).coins(2);

    expect(token0.toLowerCase()).to.equal(DAI.toLowerCase());
    expect(token1.toLowerCase()).to.equal(USDC.toLowerCase());
    expect(token2.toLowerCase()).to.equal(USDT.toLowerCase());
  });

  it("Should add/remove liquidity for 1 token only", async () => {
    const amounts = [0, 50n * 10n ** 6n, 0]; // 50 DAI

    await usdc.connect(vitalik).approve(pool3.address, amounts[1]);

    const addLiquidity = await pool3
      .connect(vitalik)
      .add_liquidity(amounts, 0, {
        gasLimit: 3000000,
      });

    const { gasUsed } = await addLiquidity.wait();

    console.log(`AddLiquidity gas: ${gasUsed}`);

    const liquidity = 48n * 10n ** 18n;
    const minAmounts = [0, 0, 0];

    const removeLiquidity = await pool3
      .connect(vitalik)
      .remove_liquidity(liquidity, minAmounts, {
        gasLimit: 3000000,
      });

    const { gasUsed: gasUsed2 } = await removeLiquidity.wait();

    console.log(`RemoveLiquidity gas: ${gasUsed2}`);
  });

  it("Should calculate token amounts", async () => {
    const usdcAmount = 50n * 10n ** 6n; // 50 USDC

    const amounts = [0, usdcAmount, 0];

    const calculated = await pool3
      .connect(vitalik)
      .calc_token_amount(amounts, true, {
        gasLimit: 3000000,
      });

    console.log(`Calculated liquidity for 50 USDC: ${calculated}`);
  });

  it("Should exchange DAI for USDT", async () => {
    const daiAmount = 50n * 10n ** 18n; // 50 DAI
    const usdtAmount = 47n * 10n ** 6n; // Minimum receive = 47 USDT

    const usdtBalanceBefore = await usdt.balanceOf(vitalik.address);

    console.log(`USDT balance before exchanging 50 DAI: ${usdtBalanceBefore}`);

    await dai.connect(vitalik).approve(pool3.address, daiAmount);
    const exchange = await pool3
      .connect(vitalik)
      .exchange(0, 2, daiAmount, usdtAmount, {
        gasLimit: 3000000,
      });

    const { gasUsed } = await exchange.wait();

    console.log(`Exchange gasUsed: ${gasUsed}`);

    const usdtBalanceAfter = await usdt.balanceOf(vitalik.address);

    console.log(`USDT balance after exchanging 50 DAI: ${usdtBalanceAfter}`);
  });

  it("Should exchange USDC for DAI", async () => {
    const usdcAmount = 50n * 10n ** 6n;

    const usdcBalanceBefore = await usdc.balanceOf(vitalik.address);

    console.log(`DAI balance before exchanging 50 USDC: ${usdcBalanceBefore}`);

    await usdc.connect(vitalik).approve(pool3.address, usdcAmount);
    const exchange = await pool3
      .connect(vitalik)
      .exchange(1, 0, usdcAmount, 0, {
        gasLimit: 3000000,
      });

    const { gasUsed } = await exchange.wait();

    console.log(`Exchange gasUsed: ${gasUsed}`);

    const usdcBalanceAfter = await usdc.balanceOf(vitalik.address);

    console.log(`USDT balance after exchanging 50 DAI: ${usdcBalanceAfter}`);
  });

  before(async () => {
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [acc1],
    });

    vitalik = await ethers.getSigner(acc1);

    dai = await ethers.getContractAt("IERC20", DAI, vitalik);
    usdc = await ethers.getContractAt("IERC20", USDC, vitalik);
    usdt = await ethers.getContractAt("IERC20", USDT, vitalik);
  });
});
