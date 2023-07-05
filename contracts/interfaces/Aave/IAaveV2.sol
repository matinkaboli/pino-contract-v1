// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
pragma abicoder v2;

/// @title IAaveV2 proxy contract
/// @author Matin Kaboli
interface IAaveV2 {
    struct DepositParams {
        address token;
        uint256 amount;
        address recipient;
    }

    /// @notice Deposits an ERC20 token to the pool and sends the underlying aToken to msg.sender
    /// @param _params Supply parameters
    /// token Token to deposit
    /// amount Amount to deposit
    /// recipient Recipient of the deposit that will receive aTokens
    function deposit(DepositParams calldata _params) external payable;

    struct WithdrawParams {
        address token;
        uint256 amount;
        address recipient;
    }

    /// @notice Receives aToken and sends ERC20 token to msg.sender
    /// @param _params Withdraw params
    /// token Token to withdraw
    /// amount Amount to withdraw
    /// recipient Recipient to receive ERC20 tokens
    function withdraw(WithdrawParams calldata _params) external payable;

    struct WithdrawETHParams {
        uint256 amount;
        address recipient;
    }

    /// @notice Receives underlying A_WETH and sends ETH token to msg.sender
    /// @param _params Withdraw params
    /// amount Amount to withdraw
    /// recipient Recipient to receive ETH
    function withdrawETH(WithdrawETHParams calldata _params) external payable;

    struct RepayParams {
        address token;
        uint96 rateMode;
        uint256 amount;
        address recipient;
    }

    /// @notice Repays a borrowed token
    /// @param _params Rate mode, 1 for stable and 2 for variable
    /// token Token to repay
    /// amount Amount to repay
    /// rateMode Rate mode, 1 for stable and 2 for variable
    /// recipient Recipient to repay for
    function repay(RepayParams calldata _params) external payable;
}
