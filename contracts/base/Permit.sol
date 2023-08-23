// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IWETH9} from "../interfaces/token/IWETH9.sol";
import {Permit2, ISignatureTransfer} from "../Permit2/Permit2.sol";

/**
 * @title Permit2 SignatureTransfer functions
 * @author Pino development team
 */
contract Permit {
    IWETH9 public immutable WETH;
    Permit2 public immutable permit2;

    /**
     * @notice Proxy contract constructor, sets permit2 and weth addresses
     * @param _permit2 Permit2 contract address
     * @param _weth WETH9 contract address
     */
    constructor(Permit2 _permit2, IWETH9 _weth) {
        WETH = _weth;
        permit2 = _permit2;
    }

    /**
     * @notice Transfers 1 token from user to the contract using Permit2
     * @param _permit PermitTransferFrom data struct
     * @param _signature Signature of the _permit struct
     */
    function permitTransferFrom(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        public
        payable
    {
        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );
    }

    /**
     * @notice Transfers multiple tokens from user to the contract using Permit2
     * @param _permit permitBatchTransferFrom data struct
     * @param _signature Signature of the _permit struct
     */
    function permitBatchTransferFrom(
        ISignatureTransfer.PermitBatchTransferFrom calldata _permit,
        bytes calldata _signature
    ) public payable {
        // Store the length of the permitted array
        uint256 tokensLen = _permit.permitted.length;

        ISignatureTransfer.SignatureTransferDetails[] memory details =
            new ISignatureTransfer.SignatureTransferDetails[](tokensLen);

        // Loop through each permitted and save the data into details
        for (uint256 i = 0; i < tokensLen;) {
            details[i].to = address(this);
            details[i].requestedAmount = _permit.permitted[i].amount;

            unchecked {
                ++i;
            }
        }

        permit2.permitTransferFrom(_permit, details, msg.sender, _signature);
    }
}
