// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "../Proxy.sol";
import "./IBalancer.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IWETH9.sol";

/// @title Balancer proxy contract
/// @author Matin Kaboli
/// @notice Deposits and Withdraws ERC20/ETH tokens to the vault and handles swap functions
/// @dev This contract uses Permit2
contract Balancer is IBalancer, Proxy {
    using SafeERC20 for IERC20;

    IVault immutable vault;

    /// @notice Sets Balancer Vault address and approves assets to it
    /// @param _permit2 Permit2 contract address
    /// @param _vault Balancer Vault contract address
    /// @param _tokens ERC20 tokens, they're approved beforehand
    constructor(Permit2 _permit2, IVault _vault, IERC20[] memory _tokens) Proxy(_permit2) {
        vault = _vault;

        for (uint256 i = 0; i < _tokens.length;) {
            _tokens[i].safeApprove(address(_vault), type(uint256).max);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Approves ERC20 tokens to Balancer Vault contract
    /// @param _token ERC20 token to be approved
    function approveToken(IERC20 _token) public {
        _token.safeApprove(address(vault), type(uint256).max);
    }

    /// @inheritdoc IBalancer
    function joinPool(IBalancer.JoinPoolParams calldata params) public payable {
        uint256 permitLength = params.permit.permitted.length;

        ISignatureTransfer.SignatureTransferDetails[] memory details =
            new ISignatureTransfer.SignatureTransferDetails[](permitLength);

        for (uint8 i = 0; i < permitLength;) {
            details[i].to = address(this);
            details[i].requestedAmount = params.permit.permitted[i].amount;

            unchecked {
                ++i;
            }
        }

        permit2.permitTransferFrom(params.permit, details, msg.sender, params.signature);

        IVault.JoinPoolRequest memory poolRequest = IVault.JoinPoolRequest({
            assets: params.assets,
            userData: params.userData,
            fromInternalBalance: false,
            maxAmountsIn: params.maxAmountsIn
        });

        vault.joinPool{value: msg.value - params.proxyFee}(params.poolId, address(this), msg.sender, poolRequest);
    }

    /// @inheritdoc IBalancer
    function joinPoolETH(IBalancer.JoinPoolETHParams calldata params) public payable {
        IVault.JoinPoolRequest memory poolRequest = IVault.JoinPoolRequest({
            assets: params.assets,
            userData: params.userData,
            fromInternalBalance: false,
            maxAmountsIn: params.maxAmountsIn
        });

        vault.joinPool{value: msg.value - params.proxyFee}(params.poolId, address(this), msg.sender, poolRequest);
    }

    /// @inheritdoc IBalancer
    function exitPool(IBalancer.ExitPoolParams calldata params) external payable {
        permit2.permitTransferFrom(
            params.permit,
            ISignatureTransfer.SignatureTransferDetails({
                to: address(this),
                requestedAmount: params.permit.permitted.amount
            }),
            msg.sender,
            params.signature
        );

        IVault.ExitPoolRequest memory exitRequest = IVault.ExitPoolRequest({
            assets: params.assets,
            userData: params.userData,
            toInternalBalance: false,
            minAmountsOut: params.minAmountsOut
        });

        vault.exitPool(params.poolId, address(this), payable(msg.sender), exitRequest);
    }

    /// @notice Swaps a token for another token in a pool
    /// @param _poolId Pool id
    /// @param _assetOut Expected token out address
    /// @param _limit The minimum amount of expected token out
    /// @param _userData User data structure, can be left empty
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    function swap(
        bytes32 _poolId,
        IAsset _assetOut,
        uint256 _limit,
        bytes calldata _userData,
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature
    ) external payable {
        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        IVault.SingleSwap memory singleSwap = IVault.SingleSwap({
            poolId: _poolId,
            kind: IVault.SwapKind.GIVEN_IN,
            assetIn: IAsset(_permit.permitted.token),
            assetOut: _assetOut,
            amount: _permit.permitted.amount,
            userData: _userData
        });

        IVault.FundManagement memory funds = IVault.FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(msg.sender),
            toInternalBalance: false
        });

        vault.swap(singleSwap, funds, _limit, block.timestamp);
    }

    /// @notice Swaps ETH for another token in a pool
    /// @param _poolId Pool id
    /// @param _assetOut Expected token out address
    /// @param _limit The minimum amount of expected token out
    /// @param _userData User data structure, can be left empty
    /// @param _proxyFee Fee of the proxy contract
    function swapETH(bytes32 _poolId, IAsset _assetOut, uint256 _limit, bytes calldata _userData, uint256 _proxyFee)
        external
        payable
    {
        IVault.SingleSwap memory singleSwap = IVault.SingleSwap({
            poolId: _poolId,
            kind: IVault.SwapKind.GIVEN_IN,
            assetIn: IAsset(address(0)),
            assetOut: _assetOut,
            amount: msg.value - _proxyFee,
            userData: _userData
        });

        IVault.FundManagement memory funds = IVault.FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(msg.sender),
            toInternalBalance: false
        });

        vault.swap{value: msg.value - _proxyFee}(singleSwap, funds, _limit, block.timestamp);
    }

    /// @inheritdoc IBalancer
    function batchSwap(IBalancer.BatchSwapParams calldata params) public payable {
        uint256 permitLength = params.permit.permitted.length;

        ISignatureTransfer.SignatureTransferDetails[] memory details =
            new ISignatureTransfer.SignatureTransferDetails[](permitLength);

        for (uint8 i = 0; i < permitLength;) {
            details[i].to = address(this);
            details[i].requestedAmount = params.permit.permitted[i].amount;

            unchecked {
                ++i;
            }
        }

        permit2.permitTransferFrom(params.permit, details, msg.sender, params.signature);

        IVault.FundManagement memory funds = IVault.FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(msg.sender),
            toInternalBalance: false
        });

        vault.batchSwap{value: msg.value}(
            IVault.SwapKind.GIVEN_IN, params.swaps, params.assets, funds, params.limits, block.timestamp
        );
    }
}
