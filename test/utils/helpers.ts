// helpers
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { constants } from "ethers";
import {
  PERMIT2_ADDRESS,
  TokenPermissions,
  SignatureTransfer,
  PermitBatchTransferFrom,
} from "@uniswap/permit2-sdk";
import { PermitTransferFrom } from "@uniswap/permit2-sdk/dist/PermitTransferFrom";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const signer = async (account: SignerWithAddress) => {
  const { chainId } = await ethers.provider.getNetwork();

  return async (permitted: TokenPermissions, spender: string) => {
    const permit: PermitTransferFrom = {
      permitted,
      spender,
      nonce: Math.floor(Math.random() * 5000),
      deadline: constants.MaxUint256,
    };

    const { domain, types, values } = SignatureTransfer.getPermitData(
      permit,
      PERMIT2_ADDRESS,
      chainId
    );

    const signature = await account._signTypedData(domain, types, values);

    return { permit, signature };
  };
};

export const multiSigner = async (account: SignerWithAddress) => {
  const { chainId } = await ethers.provider.getNetwork();

  return async (permitted: TokenPermissions[], spender: string) => {
    const permit: PermitBatchTransferFrom = {
      permitted,
      spender,
      nonce: Math.floor(Math.random() * 5000),
      deadline: constants.MaxUint256,
    };

    const { domain, types, values } = SignatureTransfer.getPermitData(
      permit,
      PERMIT2_ADDRESS,
      chainId
    );

    const signature = await account._signTypedData(domain, types, values);

    return { permit, signature };
  };
};

export const impersonate = async (address: string) => {
  await hardhat.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  return await ethers.getSigner(address);
};
