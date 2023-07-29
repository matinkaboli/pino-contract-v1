// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./Errors.sol";
import "../helpers/ErrorCodes.sol";

/// @title Handles ETH re-usabilitiy
/// @author Pino Development Team
contract EthLocker is Errors {
    // 2 means unlocked. 1 means locked
    uint8 private locked = 2;

    function lockEth() internal {
        locked = 1;
    }

    function unlockEth() internal {
        locked = 2;
    }

    modifier ethLocked() {
        _require(locked == 1, ErrorCodes.ETHER_AMOUNT_SURPASSES_MSG_VALUE);

        _;
    }

    modifier ethUnlocked() {
        _require(locked == 2, ErrorCodes.ETHER_AMOUNT_SURPASSES_MSG_VALUE);
        locked = 1;

        _;
    }
}
