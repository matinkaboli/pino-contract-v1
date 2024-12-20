// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Payments} from "./Payments.sol";
import {Permit2} from "../Permit2/Permit2.sol";
import {Ownable} from "../libraries/Ownable.sol";
import {IWETH9} from "../interfaces/token/IWETH9.sol";

/**
 * @title Handles owner functions
 * @author Pino development team
 */
contract Owner is Ownable, Payments {
    /**
     * @notice Proxy contract constructor, sets permit2 and weth addresses
     * @param _permit2 Permit2 contract address
     * @param _weth WETH9 contract address
     */
    constructor(Permit2 _permit2, IWETH9 _weth) Payments(_permit2, _weth) {}

    /**
     * @notice Withdraws fees and transfers them to owner
     * @param _recipient Address of the destination receiving the fees
     */
    function withdrawAdmin(address _recipient) external onlyOwner {
        require(address(this).balance > 0);

        _sendETH(_recipient, address(this).balance);
    }
}
