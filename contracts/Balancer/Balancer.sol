// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "../Pino.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/Balancer/IVault.sol";
import "../interfaces/Balancer/IBalancer.sol";

/// @title Balancer proxy contract
/// @author Matin Kaboli
/// @notice Deposits and Withdraws ERC20/ETH tokens to the vault and handles swap functions
/// @dev This contract uses Permit2
contract Balancer is IBalancer, Pino {
    using SafeERC20 for IERC20;

    IVault immutable Vault;

    /// @notice Sets Balancer Vault address and approves assets to it
    /// @param _permit2 Permit2 contract address
    /// @param _vault Balancer Vault contract address
    constructor(Permit2 _permit2, IWETH9 _weth, IVault _vault) Pino(_permit2, _weth) {
        Vault = _vault;

        IERC20(address(_weth)).safeApprove(address(_vault), type(uint256).max);
    }

    /// @inheritdoc IBalancer
    function joinPool(IBalancer.JoinPoolParams calldata _params) public payable {
        IVault.JoinPoolRequest memory poolRequest = IVault.JoinPoolRequest({
            assets: _params.assets,
            userData: _params.userData,
            fromInternalBalance: false,
            maxAmountsIn: _params.maxAmountsIn
        });

        Vault.joinPool(_params.poolId, address(this), msg.sender, poolRequest);
    }

    /// @inheritdoc IBalancer
    function exitPool(IBalancer.ExitPoolParams calldata _params) external payable {
        IVault.ExitPoolRequest memory exitRequest = IVault.ExitPoolRequest({
            assets: _params.assets,
            toInternalBalance: false,
            userData: _params.userData,
            minAmountsOut: _params.minAmountsOut
        });

        Vault.exitPool(_params.poolId, address(this), payable(msg.sender), exitRequest);
    }

    /// @inheritdoc IBalancer
    function swap(
        IBalancer.SwapParams calldata _params
    ) external payable {
        IVault.SingleSwap memory singleSwap = IVault.SingleSwap({
            kind: _params.kind,
            amount: _params.amount,
            poolId: _params.poolId,
            assetIn: _params.assetIn,
            assetOut: _params.assetOut,
            userData: _params.userData
        });

        IVault.FundManagement memory funds = IVault.FundManagement({
            sender: address(this),
            toInternalBalance: false,
            fromInternalBalance: false,
            recipient: payable(msg.sender)
        });

        Vault.swap(singleSwap, funds, _params.limit, block.timestamp);
    }

    /// @inheritdoc IBalancer
    function batchSwap(IBalancer.BatchSwapParams calldata _params) public payable {
        IVault.FundManagement memory funds = IVault.FundManagement({
            sender: address(this),
            toInternalBalance: false,
            fromInternalBalance: false,
            recipient: payable(msg.sender)
        });

        Vault.batchSwap(
            _params.kind, _params.swaps, _params.assets, funds, _params.limits, block.timestamp
        );
    }
}
