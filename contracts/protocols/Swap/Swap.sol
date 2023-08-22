// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Pino} from "../../base/Pino.sol";
import {Permit2} from "../../Permit2/Permit2.sol";
import {ISwap} from "../../interfaces/Swap/ISwap.sol";
import {IWETH9} from "../../interfaces/token/IWETH9.sol";
import {IERC20} from "../../interfaces/token/IERC20.sol";
import {ErrorCodes} from "../../libraries/ErrorCodes.sol";

/**
 * @title Swap Proxy contract
 * @author Pino development team
 * @notice Swaps tokens and send the new token to the recipient
 * @dev This contract uses Permit2 and supports 1Inch, 0x, Paraswap
 */
contract Swap is ISwap, Pino {
    // Addresses of swap protocols
    address public ZeroX;
    address public OneInch;
    address public Paraswap;

    /**
     * @notice Sets protocol addresses and approves WETH to them
     * @param _permit2 Permit2 contract address
     * @param _weth WETH9 contract address
     * @param _zeroX 0x contract address
     * @param _oneInch 1Inch contract address
     * @param _paraswap Paraswap contract address
     */
    constructor(Permit2 _permit2, IWETH9 _weth, address _zeroX, address _oneInch, address _paraswap)
        Pino(_permit2, _weth)
    {
        ZeroX = _zeroX;
        OneInch = _oneInch;
        Paraswap = _paraswap;

        // Approve WETH9 to all of them
        _weth.approve(_zeroX, type(uint256).max);
        _weth.approve(_oneInch, type(uint256).max);
        _weth.approve(_paraswap, type(uint256).max);
    }

    /**
     * @notice Swaps using 0x protocol
     * @param _calldata 0x protocol calldata from API
     */
    function swapZeroX(bytes calldata _calldata) external payable {
        (bool success,) = payable(ZeroX).call(_calldata);

        _require(success, ErrorCodes.FAIELD_TO_SWAP_USING_0X);
    }

    /**
     * @notice Swaps using 1Inch protocol
     * @param _calldata 1Inch protocol calldata from API
     */
    function swapOneInch(bytes calldata _calldata) external payable {
        (bool success,) = OneInch.call(_calldata);

        _require(success, ErrorCodes.FAIELD_TO_SWAP_USING_1INCH);
    }

    /*
    * @notice Swaps using Paraswap protocol
    * @param _calldata Paraswap protocol calldata from API
    */
    function swapParaswap(bytes calldata _calldata) external payable {
        (bool success,) = Paraswap.call(_calldata);

        _require(success, ErrorCodes.FAIELD_TO_SWAP_USING_PARASWAP);
    }

    /**
     * @notice Sets new addresses for 1Inch and Paraswap protocols
     * @param _oneInch Address of the new 1Inch contract
     * @param _paraswap Address of the new Paraswap contract
     * @param _zeroX Address of the new 0x contract
     */
    function setNewAddresses(address _oneInch, address _paraswap, address _zeroX) external onlyOwner {
        OneInch = _oneInch;
        ZeroX = _zeroX;
        Paraswap = _paraswap;
    }
}
