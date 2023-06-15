// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./helpers/Errors.sol";
import "./interfaces/IWETH9.sol";
import "./interfaces/Permit2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Proxy is Ownable {
    using SafeERC20 for IERC20;

    error ProxyError(uint256 errCode);

    IWETH9 public immutable WETH;
    Permit2 public immutable permit2;

    /// @notice Proxy contract constructor, sets permit2 and weth addresses
    /// @param _permit2 Permit2 contract address
    /// @param _weth WETH9 contract address
    constructor(Permit2 _permit2, IWETH9 _weth) {
        WETH = _weth;
        permit2 = _permit2;
    }

    /// @notice Withdraws fees and transfers them to owner
    function withdrawAdmin() public onlyOwner {
        require(address(this).balance > 0);

        sendETH(owner(), address(this).balance);
    }

    /// @notice Approves an ERC20 token to lendingPool and wethGateway
    /// @param _token ERC20 token address
    /// @param _spenders ERC20 token address
    function approveToken(IERC20 _token, address[] calldata _spenders) external onlyOwner {
        for (uint8 i = 0; i < _spenders.length;) {
            _token.safeApprove(_spenders[i], type(uint256).max);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Handles custom error codes
    /// @param _condition The condition, if it's false then execution is reverted
    /// @param _code Custom code, listed in Errors.sol
    function _require(bool _condition, uint256 _code) internal {
        if (!_condition) {
            revert ProxyError(_code);
        }
    }

    /// @notice Sweeps contract tokens to msg.sender
    /// @notice _token ERC20 token address
    function _sweepToken(address _token) internal {
        uint256 balanceOf = IERC20(_token).balanceOf(address(this));

        if (balanceOf > 0) {
            _token.safeTransfer(msg.sender, balanceOf);
        }
    }

    /// @notice Sends ETH to the destination
    /// @param _recipient The destination address
    /// @param _amount Ether amount
    function _sendETH(address _recipient, uint256 _amount) internal {
        (bool success,) = payable(recipient).call{value: amount}("");

        _require(success, Errors.FAILED_TO_SEND_ETHER);
    }

    /// @notice Unwraps WETH9 to Ether and sends the amount to the recipient
    /// @param _recipient The destination address
    function _unwrapWETH9(address _recipient) internal {
        uint256 balanceWETH = WETH.balanceOf(address(this));

        if (balanceWETH > 0) {
            WETH.withdraw(balanceWETH);

            _sendETH(_recipient, balanceWETH);
        }
    }

    receive() external payable {}
}
