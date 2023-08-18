// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Permit} from "./Permit.sol";
import {Errors} from "./Errors.sol";
import {EthLocker} from "./EthLocker.sol";
import {Permit2} from "../Permit2/Permit2.sol";
import {SafeERC20} from "../libraries/SafeERC20.sol";
import {IERC20} from "../interfaces/token/IERC20.sol";
import {IWETH9} from "../interfaces/token/IWETH9.sol";
import {ErrorCodes} from "../libraries/ErrorCodes.sol";

/**
 * @title Handles custom payment functions
 * @author Pino development team
 */
contract Payments is Errors, Permit, EthLocker {
    using SafeERC20 for IERC20;

    /**
     * @notice Proxy contract constructor, sets permit2 and weth addresses
     * @param _permit2 Permit2 contract address
     * @param _weth WETH9 contract address
     */
    constructor(Permit2 _permit2, IWETH9 _weth) Permit(_permit2, _weth) {}

    /**
     * @notice Sweeps contract tokens to msg.sender
     * @param _token ERC20 token address
     * @param _recipient The destination address
     */
    function sweepToken(IERC20 _token, address _recipient) public payable {
        uint256 balanceOf = _token.balanceOf(address(this));

        if (balanceOf > 0) {
            _token.safeTransfer(_recipient, balanceOf);
        }
    }

    /**
     * @notice Transfers ERC20 token to recipient
     * @param _recipient The destination address
     * @param _token ERC20 token address
     * @param _amount Amount to transfer
     */
    function _send(IERC20 _token, address _recipient, uint256 _amount) internal {
        _token.safeTransfer(_recipient, _amount);
    }

    /**
     * @notice Permits _spender to spend max amount of ERC20 from the contract
     * @param _token ERC20 token address
     * @param _spender Spender address
     */
    function _approve(IERC20 _token, address _spender) internal {
        _token.safeIncreaseAllowance(_spender, type(uint256).max);
    }

    /**
     * @notice Sends ETH to the destination
     * @param _recipient The destination address
     * @param _amount Ether amount
     */
    function _sendETH(address _recipient, uint256 _amount) internal {
        (bool success,) = payable(_recipient).call{value: _amount}("");

        _require(success, ErrorCodes.FAILED_TO_SEND_ETHER);
    }

    /**
     * @notice Approves an ERC20 token to lendingPool and wethGateway
     * @param _token ERC20 token address
     * @param _spenders ERC20 token address
     */
    function approveToken(IERC20 _token, address[] calldata _spenders) external {
        for (uint8 i = 0; i < _spenders.length;) {
            _approve(_token, _spenders[i]);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Wraps ETH to WETH
     * @param _proxyFee Fee of the proxy contract
     */
    function wrapETH(uint96 _proxyFee) external payable ethUnlocked {
        uint256 value = msg.value - _proxyFee;

        WETH.deposit{value: value}();
    }

    /**
     * @notice Unwraps WETH9 to Ether and sends the amount to the recipient
     * @param _recipient The destination address
     */
    function unwrapWETH9(address _recipient) public payable {
        uint256 balanceWETH = WETH.balanceOf(address(this));

        if (balanceWETH > 0) {
            WETH.withdraw(balanceWETH);

            _sendETH(_recipient, balanceWETH);
        }
    }
}
