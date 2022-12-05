// Curve2pool
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const SWAP = "0x55b916ce078ea594c10a874ba67ecc3d62e29822";
const EURS = "0xdb25f211ab05b1c97d595516f45794528a807ad8"; // 2 decimal
const USDC = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
const USDT = "0xDAC17F958D2EE523A2206206994597C13D831EC7";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const EURS_WHALE = "0xe5379345675132653bd303030c6e456034ed1961";

const eursAmount = 1000n * 10n ** 2n;
const amount = 1000n * 10n ** 6n; // $1000
const daiAmount = 1000n * 10n ** 18n; // $1000

describe("CurveSwap", () => {
  let dai: IERC20;
  let eurs: IERC20;
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

    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [EURS_WHALE],
    });

    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);
    usdt = await ethers.getContractAt("IERC20", USDT);
    eurs = await ethers.getContractAt("IERC20", EURS);

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);
    const eursWhale = await ethers.getSigner(EURS_WHALE);

    await usdc.connect(whale).transfer(accounts[0].address, amount);
    await usdt.connect(whale).transfer(accounts[0].address, amount);
    await dai.connect(whale).transfer(accounts[0].address, daiAmount);
    await eurs.connect(eursWhale).transfer(accounts[0].address, eursAmount);

    const usdcBalance = await usdc.balanceOf(accounts[0].address);
    const usdtBalance = await usdt.balanceOf(accounts[0].address);
    const daiBalance = await dai.balanceOf(accounts[0].address);
    const eursBalance = await eurs.balanceOf(accounts[0].address);

    expect(usdtBalance).to.equal(amount);
    expect(usdcBalance).to.equal(amount);
    expect(daiBalance).to.equal(daiAmount);
    expect(eursBalance).to.equal(eursAmount);
  });

  describe("Exchange", () => {
    it("Should exchange USDC for DAI", async () => {
      const curve = await loadFixture(deploy);

      const exchangeAmount = 50n * 10n ** 6n;
      const exchangeAmountInDai = 50n * 10n ** 18n;

      const daiBalanceBefore = await dai.balanceOf(accounts[0].address);

      await usdc.connect(accounts[0]).approve(curve.address, exchangeAmount);

      await curve.exchange(USDC, DAI, exchangeAmount, 0);
      // gasUsed: 2001k

      const daiBalanceAfter = await dai.balanceOf(accounts[0].address);

      expect(daiBalanceAfter).to.be.gt(
        daiBalanceBefore.add((exchangeAmountInDai / 10n) * 9n)
      );
    });

    it("Should exchange DAI for USDC", async () => {
      const curve = await loadFixture(deploy);

      const exchangeAmount = 50n * 10n ** 18n;
      const exchangeAmountInUsdc = 50n * 10n ** 6n;

      await dai.connect(accounts[0]).approve(curve.address, exchangeAmount);

      const usdcBalanceBefore = await usdc.balanceOf(accounts[0].address);

      await curve.exchange(DAI, USDC, exchangeAmount, 0);
      // gasUsed: 2307781

      const usdcBalanceAfter = await usdc.balanceOf(accounts[0].address);

      expect(usdcBalanceAfter).to.be.gt(
        usdcBalanceBefore.add((exchangeAmountInUsdc / 10n) * 9n)
      );
    });

    it("Should exchange EURS for DAI (using multiple_exchange)", async () => {
      const curve = await loadFixture(deploy);

      const exchangeAmount = 100n * 10n ** 2n;

      await eurs.connect(accounts[0]).approve(curve.address, exchangeAmount);

      const routes = [
        EURS, // initial token
        "0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b", // eursusd USDC-EURS pool
        USDC, // USDC token
        "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7", // 3pool DAI-USDC-USDT pool
        DAI, // DAI token
        "0x0000000000000000000000000000000000000000", // Finish
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ];

      const swapParams = [
        [1, 0, 1],
        [1, 0, 1],
        // [0, 0, 0],
        // [0, 0, 0],
      ];

      await curve.exchange_multiple(routes, swapParams, exchangeAmount, 0, []);
    });
  });

  describe("Admin actions", () => {
    it("Withdraws money", async () => {
      const curve = await loadFixture(deploy);

      const userBalanceBefore = await ethers.provider.getBalance(
        accounts[0].address
      );

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
