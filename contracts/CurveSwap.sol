// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICurveSwap {
  function exchange_with_best_rate(
    address _from,
    address _to,
    uint _amount,
    uint _expected,
    address _receiver
  ) external payable returns (uint);
}

contract CurveSwap is Ownable {
  using SafeERC20 for IERC20;

  address immutable public swap;

  constructor(address _swap) {
    swap = _swap;
  }

  function exchange(address from, address to, uint amount, uint expected) external payable returns (uint) {
    IERC20(from).safeTransferFrom(msg.sender, address(this), amount);
    IERC20(from).approve(swap, type(uint).max);

    uint swapped = ICurveSwap(swap).exchange_with_best_rate(from, to, amount, expected, msg.sender);

    return swapped;
  }

  /// @notice Withdraws fees and transfers them to owner
  function withdrawAdmin() public onlyOwner {
    require(address(this).balance > 0);

    payable(owner()).transfer(address(this).balance);
  }
}
