// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "./IERC20.sol";

/**
 * @notice IWETH9 WETH interface
 */
interface IWETH9 is IERC20 {
    receive() external payable;
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}
