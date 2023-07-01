// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../Pino.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/Aave/IAaveV2.sol";
import "../interfaces/Aave/IWethGateway.sol";
import "../interfaces/Aave/ILendingPoolV2.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title AaveV2 proxy contract
/// @author Matin Kaboli
/// @notice Deposits and Withdraws ERC20 tokens to the lending pool
/// @dev This contract uses Permit2
contract AaveV2 is IAaveV2, Pino {
    using SafeERC20 for IERC20;

    ILendingPoolV2 public lendingPool;
    IWethGateway public wethGateway;

    /// @notice Sets LendingPool address and approves assets and aTokens to it
    /// @param _lendingPool Aave lending pool address
    /// @param _wethGateway Aave WethGateway contract address
    /// @param _permit2 Address of Permit2 contract
    /// @param _tokens ERC20 tokens, they're approved beforehand
    constructor(
        Permit2 _permit2,
        IWETH9 _weth,
        ILendingPoolV2 _lendingPool,
        IWethGateway _wethGateway,
        IERC20[] memory _tokens
    ) Pino(_permit2, _weth) {
        lendingPool = _lendingPool;
        wethGateway = _wethGateway;

        for (uint8 i = 0; i < _tokens.length;) {
            _tokens[i].safeApprove(address(_lendingPool), type(uint256).max);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Changes LendingPool and WethGateway address if necessary
    /// @param _lendingPool Address of the new lending pool contract
    /// @param _wethGateway Address of the new weth gateway
    function setNewAddresses(ILendingPoolV2 _lendingPool, IWethGateway _wethGateway) external onlyOwner {
        lendingPool = _lendingPool;
        wethGateway = _wethGateway;
    }

    /// @notice Deposits an ERC20 token to the pool and sends the underlying aToken to msg.sender
    /// @param _params Supply parameters
    /// token Token to deposit
    /// amount Amount to deposit
    /// recipient Recipient of the deposit that will receive aTokens
    function deposit(IAaveV2.DepositParams calldata _params) external payable {
        lendingPool.deposit(_params.token, _params.amount, _params.recipient, 0);
    }

    /// @notice Receives aToken and sends ERC20 token to msg.sender
    /// @param _params Withdraw params
    /// token Token to withdraw
    /// amount Amount to withdraw
    /// recipient Recipient to receive ERC20 tokens
    function withdraw(IAaveV2.WithdrawParams calldata _params)
        external
        payable
    {
        lendingPool.withdraw(_params.token, _params.amount, _params.recipient);
    }

    /// @notice Receives underlying A_WETH and sends ETH token to msg.sender
    /// @param _params Withdraw params
    /// amount Amount to withdraw
    /// recipient Recipient to receive ETH
    function withdrawETH(IAaveV2.WithdrawETHParams calldata _params)
        external
        payable
    {
        wethGateway.withdrawETH(address(lendingPool), _params.amount, _params.recipient);
    }

    /// @notice Repays a borrowed token
    /// @param _params Rate mode, 1 for stable and 2 for variable
    /// token Token to repay
    /// amount Amount to repay
    /// rateMode Rate mode, 1 for stable and 2 for variable
    /// recipient Recipient to repay for
    function repay(IAaveV2.RepayParams calldata _params)
        external
        payable
    {
        lendingPool.repay(_params.token, _params.amount, _params.rateMode, _params.recipient);
    }
}
