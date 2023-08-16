// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../Pino.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {ISwap} from "../interfaces/Swap/ISwap.sol";

/// @title Swap Proxy contract
/// @author Pino Development Team
/// @notice Swaps tokens and send the new token to the recipient
/// @dev This contract uses Permit2 and supports 1Inch, 0x, Paraswap, Uniswap, Balancer, and Curve
contract Swap is ISwap, Pino {
    // Addresses of swap protocols
    address public ZeroX;
    address public Curve;
    address public OneInch;
    address public Uniswap;
    address public Paraswap;
    address public Balancer;

    /// @notice Sets protocol addresses and approves WETH to them
    /// @param _permit2 Permit2 contract address
    /// @param _weth WETH9 contract address
    /// @param _zeroX 0x contract address
    /// @param _curve CurveSwap contract address
    /// @param _oneInch 1Inch contract address
    /// @param _uniswap Uniswap SWAP_ROUTER_2
    /// @param _paraswap Paraswap contract address
    /// @param _balancer Balancer contract address
    constructor(
        Permit2 _permit2,
        IWETH9 _weth,
        address _zeroX,
        address _curve,
        address _oneInch,
        address _uniswap,
        address _paraswap,
        address _balancer
    ) Pino(_permit2, _weth) {
        ZeroX = _zeroX;
        Curve = _curve;
        OneInch = _oneInch;
        Uniswap = _uniswap;
        Paraswap = _paraswap;
        Balancer = _balancer;

        // Approve WETH9 to all of them
        IERC20(address(_weth)).approve(_zeroX, type(uint256).max);
        IERC20(address(_weth)).approve(_curve, type(uint256).max);
        IERC20(address(_weth)).approve(_oneInch, type(uint256).max);
        IERC20(address(_weth)).approve(_uniswap, type(uint256).max);
        IERC20(address(_weth)).approve(_paraswap, type(uint256).max);
        IERC20(address(_weth)).approve(_balancer, type(uint256).max);
    }

    /// @notice Swaps using 0x protocol
    /// @param _calldata 0x protocol calldata from API
    function swapZeroX(bytes calldata _calldata) external payable {
        (bool success,) = payable(ZeroX).call(_calldata);

        _require(success, ErrorCodes.FAIELD_TO_SWAP_USING_0X);
    }

    /// @notice Swaps using 1Inch protocol
    /// @param _calldata 1Inch protocol calldata from API
    function swapOneInch(bytes calldata _calldata) external payable {
        (bool success,) = OneInch.call(_calldata);

        _require(success, ErrorCodes.FAIELD_TO_SWAP_USING_1INCH);
    }

    /// @notice Swaps using Uniswap protocol
    /// @param _calldata Uniswap protocol calldata from SDK
    /// @dev Uniswap contract points to SWAP_ROUTER_2
    function swapUniswap(bytes calldata _calldata) external payable {
        (bool success,) = Uniswap.call(_calldata);

        _require(success, ErrorCodes.FAIELD_TO_SWAP_USING_UNISWAP);
    }

    /// @notice Swaps using Paraswap protocol
    /// @param _calldata Paraswap protocol calldata from API
    function swapParaswap(bytes calldata _calldata) external payable {
        (bool success,) = Paraswap.call(_calldata);

        _require(success, ErrorCodes.FAIELD_TO_SWAP_USING_PARASWAP);
    }

    /// @notice Sets new addresses for 1Inch and Paraswap protocols
    /// @param _oneInch Address of the new 1Inch contract
    /// @param _paraswap Address of the new Paraswap contract
    /// @param _zeroX Address of the new 0x contract
    function setNewAddresses(address _oneInch, address _paraswap, address _zeroX) external onlyOwner {
        OneInch = _oneInch;
        ZeroX = _zeroX;
        Paraswap = _paraswap;
    }
}
