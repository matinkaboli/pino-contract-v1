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
  uint immutable public fee;
  address immutable public pool;
  address immutable public token;
  uint8 immutable public ethIndex;

  /// @notice Receives ERC20 tokens and Curve pool address and saves them
  /// @param _fee Fee when calculating user's ETH in payable functions
  /// @param _pool Address of Curve pool
  /// @param _tokens Addresses of ERC20 tokens inside the _pool
  /// @param _token Address of pool token
  /// @param _ethIndex Index of ETH in the pool (100 if ETH does not exist in the pool)
  constructor(address _pool, address[] memory _tokens, address _token, uint8 _ethIndex, uint _fee) {
    fee = _fee;
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
  function getBalance(uint8 _i) internal view returns (uint) {
    if (ethIndex == _i) {
      return address(this).balance;
    } 

    return IERC20(tokens[_i]).balanceOf(address(this));
  }

  /// @notice Sends ERC20 token or ETH from this contract
  /// @param _i Index of the sending token from the pool
  /// @param _amount Amount of the sending token
  function send(uint8 _i, uint _amount) internal {
    if (ethIndex == _i) {
      (bool sent,) = payable(msg.sender).call{ value: _amount }("");

      require(sent, "Failed to send Ether");
    } else {
      IERC20(tokens[_i]).transfer(msg.sender, _amount);
    }
  }

  /// @notice Calculates msg.value (takes the fee) and retrieves ERC20 tokens (transferFrom)
  /// @param _i Index of the token in the pool
  /// @param _amount Amount of the token (or ETH)
  /// @return The final amount of the token (this is needed because of msg.value manipulation)
  function calculateAndRetrieve(uint8 _i, uint _amount) internal returns (uint) {
    if (_amount == 0) {
      return 0;
    }

    if (_i == ethIndex) {
      return msg.value / fee * (fee - 1);
    }

    IERC20(tokens[_i]).safeTransferFrom(msg.sender, address(this), _amount);

    return _amount;
  }

  /// @notice Withdraws fees and transfers them to owner
  function withdrawAdmin() public onlyOwner {
    require(address(this).balance > 0);

    payable(owner()).transfer(address(this).balance);
  }

  receive() external payable {}
}
