// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

/// @title Swap Proxy contract
/// @author Pino Development Team
/// @notice Swaps tokens and send the new token to the recipient
/// @dev This contract uses Permit2 and supports 1Inch, 0x, Paraswap, Uniswap, Balancer, and Curve
interface ISwap {
    /// @notice Swaps using 0x protocol
    /// @param _calldata 0x protocol calldata from API
    function swapZeroX(bytes calldata _calldata) external payable;

    /// @notice Swaps using 1Inch protocol
    /// @param _calldata 1Inch protocol calldata from API
    function swapOneInch(bytes calldata _calldata) external payable;

    /// @notice Swaps using Uniswap protocol
    /// @param _calldata Uniswap protocol calldata from SDK
    /// @dev Uniswap contract points to SWAP_ROUTER_2
    function swapUniswap(bytes calldata _calldata) external payable;

    /// @notice Swaps using Paraswap protocol
    /// @param _calldata Paraswap protocol calldata from API
    function swapParaswap(bytes calldata _calldata) external payable;

    /// @notice Sets new addresses for 1Inch and Paraswap protocols
    /// @param _oneInch Address of the new 1Inch contract
    /// @param _paraswap Address of the new Paraswap contract
    /// @param _zeroX Address of the new 0x contract
    function setNewAddresses(address _oneInch, address _paraswap, address _zeroX) external;
}
