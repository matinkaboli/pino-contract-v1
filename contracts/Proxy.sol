// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/Permit2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Proxy is Ownable {
    using SafeERC20 for IERC20;

    error FailedToSendEther();

    Permit2 public immutable permit2;

    constructor(Permit2 _permit2) {
        permit2 = _permit2;
    }

    /// @notice Withdraws fees and transfers them to owner
    function withdrawAdmin() public onlyOwner {
        require(address(this).balance > 0);

        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
