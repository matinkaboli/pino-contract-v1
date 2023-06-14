// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/Permit2.sol";
import "./interfaces/IWETH9.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Proxy is Ownable {
    using SafeERC20 for IERC20;

    error FailedToSendEther();

    IWETH9 public immutable WETH;
    Permit2 public immutable permit2;

    constructor(Permit2 _permit2, IWETH9 _weth) {
        WETH = _weth;
        permit2 = _permit2;
    }

    /// @notice Withdraws fees and transfers them to owner
    function withdrawAdmin() public onlyOwner {
        require(address(this).balance > 0);

        payable(owner()).transfer(address(this).balance);
    }

    /// @notice Sweeps contract tokens to msg.sender
    function sweepToken(IERC20 _token) internal {
        uint256 balanceOf = _token.balanceOf(address(this));

        _token.safeTransfer(msg.sender, balanceOf);
    }

    /// @notice Approves an ERC20 token to lendingPool and wethGateway
    /// @param _token ERC20 token address
    function approveToken(IERC20 _token, address[] calldata _spenders) external onlyOwner {
        for (uint8 i = 0; i < _spenders.length;) {
            _token.safeApprove(_spenders[i], type(uint256).max);

            unchecked {
                ++i;
            }
        }
    }

    function unwrapWETH9(address recipient) internal {
        uint256 balanceWETH = WETH.balanceOf(address(this));

        if (balanceWETH > 0) {
            WETH.withdraw(balanceWETH);

            (bool success,) = recipient.call{value: balanceWETH}("");
            if (!success) revert FailedToSendEther();
        }
    }

    // function multicall(bytes[] calldata data) public payable returns (bytes[] memory results) {
    //     results = new bytes[](data.length);
    //
    //     for (uint256 i = 0; i < data.length; i++) {
    //         (bool success, bytes memory result) = address(this).delegatecall(data[i]);
    //
    //         if (!success) {
    //             // Next 5 lines from https://ethereum.stackexchange.com/a/83577
    //             if (result.length < 68) revert();
    //             assembly {
    //                 result := add(result, 0x04)
    //             }
    //             revert(abi.decode(result, (string)));
    //         }
    //
    //         results[i] = result;
    //     }
    // }

    receive() external payable {}
}
