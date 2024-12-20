// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Owner} from "./Owner.sol";
import {Multicall} from "./Multicall.sol";
import {Permit2} from "../Permit2/Permit2.sol";
import {IWETH9} from "../interfaces/token/IWETH9.sol";

/**
 * @title Pino main contract layout
 * @author Pino development team
 * @notice Inherits Owner, Payments, Permit2, and Multicall
 * @dev This contract uses Permit2
 */
contract Pino is Owner, Multicall {
    /**
     * @notice Proxy contract constructor, sets permit2 and weth addresses
     * @param _permit2 Permit2 contract address
     * @param _weth WETH9 contract address
     */
    constructor(Permit2 _permit2, IWETH9 _weth) Owner(_permit2, _weth) {}

    receive() external payable {}
}
