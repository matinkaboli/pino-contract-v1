// Curve
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const DAI = "0x6B175474E89094C44DA98B954EEDEAC495271D0F";
const USDC = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const poolAddress = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

const acc1 = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";

describe("Curve", () => {
  let vitalik: SignerWithAddress;
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;

  const deploy = async () => {
    const CurveProxy = await ethers.getContractFactory("Curve2");

    const curve = await CurveProxy.connect(vitalik).deploy(poolAddress, [
      DAI,
      USDC,
      USDT,
    ]);

    await dai.connect(vitalik).approve(curve.address, 20_00000000000000);
    await usdc.connect(vitalik).approve(curve.address, 100_000000);
    await usdt.connect(vitalik).approve(curve.address, 100_000000);

    await curve.connect(vitalik).approve(DAI, {
      gasLimit: 3000000,
    });

    await curve.connect(vitalik).approve(USDC, {
      gasLimit: 3000000,
    });

    return curve;
  };

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

  it("Should add liquidity for USDC", async () => {
    const curve = await loadFixture(deploy);

    const amounts = [0, 5000000, 0]; // 50 USDC

    const addLiquidity = await curve.connect(vitalik).addLiquidity(amounts, 0, {
      gasLimit: 3000000,
    });

    const { gasUsed } = await addLiquidity.wait();

    console.log(`GasUsed for addLiquidity: ${gasUsed}`);
  });

  it.skip("Should exchange DAI for USDC", async () => {
    const curve = await loadFixture(deploy);

    const usdcAmount = 50_000000;

    await usdc.connect(vitalik).approve(curve.address, usdcAmount);

    const exchange = await curve
      .connect(vitalik)
      .exchange(1, 0, usdcAmount, 0, {
        gasLimit: 5000000,
      });

    const balanceAfter = await usdc.balanceOf(curve.address);

    console.log(balanceAfter);
  });
});
