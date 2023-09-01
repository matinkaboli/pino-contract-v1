// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {EthLocker} from "./EthLocker.sol";

/**
 * @title Handles multicall function
 * @author Pino development team
 */
contract Multicall is EthLocker {
    /**
     * @notice Multiple calls on proxy functions
     * @param _calldata The destination address
     * @dev The other param is for the referral program of the Pino server
     */
    function multicall(bytes[] calldata _calldata, uint256) external payable {
        // Unlock ether locker just in case if it was locked before
        unlockEth();

        // Loop through each calldata and execute them
        for (uint256 i = 0; i < _calldata.length;) {
            (bool success, bytes memory result) = address(this).delegatecall(_calldata[i]);

            // Check if the call was successful or not
            if (!success) {
                // Next 7 lines from https://ethereum.stackexchange.com/a/83577
                if (result.length < 68) revert();

                assembly {
                    result := add(result, 0x04)
                }

                revert(abi.decode(result, (string)));
            }

            // Increment variable i more efficiently
            unchecked {
                ++i;
            }
        }

        // Unlock ether for future use
        unlockEth();
    }
}
