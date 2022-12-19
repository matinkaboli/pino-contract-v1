// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Curve proxy contract 
/// @author Matin Kaboli
/// @notice Add/Remove liquidity, and exchange tokens in a pool
contract Proxy is Ownable {
  using SafeERC20 for IERC20;

  address[] public tokens;
  address immutable public pool;
  address immutable public token;
  uint8 immutable public ethIndex;

  /// @notice Receives ERC20 tokens and Curve pool address and saves them
  /// @param _pool Address of Curve pool
  /// @param _tokens Addresses of ERC20 tokens inside the _pool
  /// @param _token Address of pool token
  /// @param _ethIndex Index of ETH in the pool (100 if ETH does not exist in the pool)
  constructor(address _pool, address[] memory _tokens, address _token, uint8 _ethIndex) {
    pool = _pool;
    token = _token;
    tokens = _tokens;
    ethIndex = _ethIndex;

    for (uint8 i = 0; i < _tokens.length; i += 1) {
      if (i != _ethIndex) {
        IERC20(tokens[i]).safeApprove(_pool, type(uint).max);
      }
    }

    IERC20(_token).safeApprove(_pool, type(uint).max);
  }

  /// @notice Returns the balance of the token (or ETH) of this contract
  /// @param _i Index of the token in the pool
  /// @return The amount of ERC20 or ETH
  function getBalance(uint _i) internal view returns (uint) {
    if (ethIndex == _i) {
      return address(this).balance;
    } 

    return IERC20(tokens[_i]).balanceOf(address(this));
  }

  /// @notice Sends ERC20 token or ETH from this contract
  /// @param _i Index of the sending token from the pool
  /// @param _amount Amount of the sending token
  function send(uint _i, uint _amount) internal {
    if (ethIndex == _i) {
      (bool sent,) = payable(msg.sender).call{ value: _amount }("");

      require(sent, "Failed to send Ether");
    } else {
      IERC20(tokens[_i]).safeTransfer(msg.sender, _amount);
    }
  }

  /// @notice Calculates msg.value (takes the fee) and retrieves ERC20 tokens (transferFrom)
  /// @param _i Index of the token in the pool
  /// @param _amount Amount of the token (or ETH)
  function retrieveToken(uint _i, uint _amount) internal {
    if (_i != ethIndex) {
      IERC20(tokens[_i]).safeTransferFrom(msg.sender, address(this), _amount);
    }
  }

  /// @notice Withdraws fees and transfers them to owner
  function withdrawAdmin() public onlyOwner {
    require(address(this).balance > 0);

    payable(owner()).transfer(address(this).balance);
  }

  receive() external payable {}
}
