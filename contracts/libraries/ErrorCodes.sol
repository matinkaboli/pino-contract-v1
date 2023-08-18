// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library ErrorCodes {
    uint248 internal constant FAILED_TO_SEND_ETHER = 0;
    uint248 internal constant ETHER_AMOUNT_SURPASSES_MSG_VALUE = 1;

    uint248 internal constant TOKENS_MISMATCHED = 2;

    uint248 internal constant FAIELD_TO_SWAP_USING_1INCH = 3;
    uint248 internal constant FAIELD_TO_SWAP_USING_PARASWAP = 4;
    uint248 internal constant FAIELD_TO_SWAP_USING_0X = 5;
    uint248 internal constant FAIELD_TO_SWAP_USING_UNISWAP = 6;
}
