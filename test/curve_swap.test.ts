// Curve2pool
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import wethInterface from "./interfaces/weth.json";

const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const FRAX = "0x853d955acef822db058eb8505911ed77f175b99e";
const SWAP = "0x55b916ce078ea594c10a874ba67ecc3d62e29822";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const EURS = "0xdb25f211ab05b1c97d595516f45794528a807ad8"; // 2 decimal
const USDC = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
const USDT = "0xDAC17F958D2EE523A2206206994597C13D831EC7";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const EURS_WHALE = "0xe5379345675132653bd303030c6e456034ed1961";

const eursAmount = 1000n * 10n ** 2n;
const amount = 1000n * 10n ** 6n; // $1000
const daiAmount = 1000n * 10n ** 18n; // $1000

describe("CurveSwap", () => {
  let weth: Contract;
  let dai: IERC20;
  let eurs: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let frax: IERC20;
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
    frax = await ethers.getContractAt("IERC20", FRAX);
    weth = new ethers.Contract(WETH, wethInterface);

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);
    const eursWhale = await ethers.getSigner(EURS_WHALE);

    await usdc.connect(whale).transfer(accounts[0].address, amount);
    await usdt.connect(whale).transfer(accounts[0].address, amount);
    await dai.connect(whale).transfer(accounts[0].address, daiAmount);
    await eurs.connect(eursWhale).transfer(accounts[0].address, eursAmount);
    await weth.connect(accounts[0]).deposit({
      value: daiAmount,
    });

    const usdcBalance = await usdc.balanceOf(accounts[0].address);
    const usdtBalance = await usdt.balanceOf(accounts[0].address);
    const daiBalance = await dai.balanceOf(accounts[0].address);
    const eursBalance = await eurs.balanceOf(accounts[0].address);
    const wethBalance = await weth
      .connect(accounts[0])
      .balanceOf(accounts[0].address);

    expect(usdtBalance).to.gte(amount);
    expect(usdcBalance).to.gte(amount);
    expect(daiBalance).to.gte(daiAmount);
    expect(eursBalance).to.gte(eursAmount);
    expect(wethBalance).to.gte(daiAmount);
  });

  describe("Exchange", () => {
    it("Should exchange DAI for USDC (using multiple_exchange)", async () => {
      const curve = await loadFixture(deploy);

      const minimumReceived = 90n * 10n ** 6n;
      const exchangeAmount = 100n * 10n ** 18n;

      await dai.connect(accounts[0]).approve(curve.address, exchangeAmount);

      const routes = [
        DAI, // initial token
        "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7", // frax
        USDC,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ];

      const swapParams = [
        [0, 1, 1],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];

      const pools = [
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ];

      const usdcBalanceBefore = await usdc.balanceOf(accounts[0].address);

      await curve.exchange_multiple(
        routes,
        swapParams,
        exchangeAmount,
        minimumReceived,
        pools,
        0
      );
      // gasUsed: 259k

      const usdcBalanceAfter = await usdc.balanceOf(accounts[0].address);

      expect(usdcBalanceAfter).to.be.gte(
        usdcBalanceBefore.add(minimumReceived)
      );
    });

    it("Should exchange EURS for DAI (using multiple_exchange)", async () => {
      const curve = await loadFixture(deploy);

      const exchangeAmount = 100n * 10n ** 2n;
      const minimumReceived = 90n * 10n ** 18n;

      await eurs.connect(accounts[0]).approve(curve.address, exchangeAmount);

      const routes = [
        EURS,
        "0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b", // eursusd
        USDC,
        "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7", // 3pool
        DAI,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ];

      const swapParams = [
        [1, 0, 3],
        [1, 0, 1],
        [0, 0, 0],
        [0, 0, 0],
      ];

      const pools = [
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ];

      const daiBalanceBefore = await dai.balanceOf(accounts[0].address);

      await curve.exchange_multiple(
        routes,
        swapParams,
        exchangeAmount,
        0,
        pools,
        0
      );
      // gasUsed: 622k

      const daiBalanceAfter = await dai.balanceOf(accounts[0].address);

      expect(daiBalanceAfter).to.be.gte(daiBalanceBefore.add(minimumReceived));
    });

    it("Should exchange WETH for EURS (using multiple_exchange)", async () => {
      const curve = await loadFixture(deploy);

      const fee = 100n;
      const exchangeAmount = 1n * 10n ** 18n;
      const minimumReceived = 1000n * 10n ** 2n;

      await weth.connect(accounts[0]).approve(curve.address, exchangeAmount);

      const routes = [
        WETH,
        "0xd51a44d3fae010294c616388b506acda1bfaae46", // tricrypto2
        USDT,
        "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7", // 3pool
        USDC,
        "0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b", // eursusd
        EURS,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ];

      const swapParams = [
        [2, 0, 3],
        [2, 1, 1],
        [0, 1, 3],
        [0, 0, 0],
      ];

      const pools = [
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ];

      const eursBalanceBefore = await eurs.balanceOf(accounts[0].address);

      await curve.exchange_multiple(
        routes,
        swapParams,
        exchangeAmount,
        0,
        pools,
        fee,
        {
          value: exchangeAmount + fee,
        }
      );
      // gasUsed: 622k

      const eursBalanceAfter = await eurs.balanceOf(accounts[0].address);

      expect(eursBalanceAfter).to.be.gte(
        eursBalanceBefore.add(minimumReceived)
      );
    });

    it("Should exchange ETH for FRAX (using multiple_exchange)", async () => {
      const curve = await loadFixture(deploy);

      const fee = 1000n;
      const exchangeAmount = 5n * 10n ** 18n;
      const minimumReceived = 6000n * 10n * 18n;

      const routes = [
        ETH,
        WETH,
        "0xd51a44d3fae010294c616388b506acda1bfaae46", // tricrypto2
        USDT,
        "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7", // 3pool
        DAI,
        "0xdcef968d416a41cdac0ed8702fac8128a64241a2", // fraxusdc
        FRAX,
        "0x0000000000000000000000000000000000000000",
        // "0x0000000000000000000000000000000000000000",
      ];

      const swapParams = [
        [2, 0, 3],
        [2, 1, 1],
        [1, 0, 1],
        [0, 0, 0],
      ];

      const pools = [
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ];

      const fraxBalanceBefore = await frax.balanceOf(accounts[0].address);

      await curve
        .connect(accounts[0])
        .exchange_multiple(
          routes,
          swapParams,
          exchangeAmount,
          minimumReceived,
          pools,
          fee,
          {
            value: exchangeAmount + fee,
          }
        );
      // gasUsed: 622k

      const fraxBalanceAfter = await frax.balanceOf(accounts[0].address);

      expect(fraxBalanceAfter).to.be.gte(
        fraxBalanceBefore.add(minimumReceived)
      );
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
