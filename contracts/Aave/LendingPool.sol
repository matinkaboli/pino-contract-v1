// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ILendingPool {
  function withdraw(address asset, uint256 amount, address to) external;
  function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// @title Aave LendingPool proxy contract 
/// @author Matin Kaboli
/// @notice Deposits and Withdraws ERC20 tokens to the lending pool
contract LendingPool is Ownable {
  using SafeERC20 for IERC20;

  address public aave;
  mapping (address => mapping (address => bool)) private alreadyApprovedTokens;

  /// @notice Sets LendingPool address and approves assets and aTokens to it
  /// @param _aave Aave lending pool address
  /// @param _tokens ERC20 tokens, they're approved beforehand 
  /// @param _aTokens underlying ERC20 tokens, they're approved beforehand
  constructor(address _aave, address[] memory _tokens, address[] memory _aTokens) {
    aave = _aave;

    for (uint8 i = 0; i < _tokens.length; i += 1) {
      IERC20(_tokens[i]).safeApprove(_aave, type(uint).max);

      alreadyApprovedTokens[_aave][_tokens[i]] = true;
    }

    for (uint8 i = 0; i < _aTokens.length; i += 1) {
      IERC20(_aTokens[i]).safeApprove(_aave, type(uint).max);

      alreadyApprovedTokens[_aave][_aTokens[i]] = true;
    }
  }

  /// @notice Sets LendingPool address and approves assets and aTokens to it
  /// @param _aave Aave lending pool address
  /// @param _tokens ERC20 tokens, they're approved beforehand 
  /// @param _aTokens underlying ERC20 tokens, they're approved beforehand
  function changeAaveAddress(address _aave, address[] memory _tokens, address[] memory _aTokens) public onlyOwner {
    aave = _aave;

    for (uint8 i = 0; i < _tokens.length; i += 1) {
      IERC20(_tokens[i]).safeApprove(_aave, type(uint).max);

      alreadyApprovedTokens[_aave][_tokens[i]] = true;
    }

    for (uint8 i = 0; i < _aTokens.length; i += 1) {
      IERC20(_aTokens[i]).safeApprove(_aave, type(uint).max);

      alreadyApprovedTokens[_aave][_aTokens[i]] = true;
    }
  }

  /// @notice Deposits an ERC20 token to the pool and sends the underlying aToken to msg.sender
  /// @param _token ERC20 token to deposit
  /// @param _amount Amount of token to deposit
  function deposit(address _token, uint _amount) public payable {
    IERC20(_token).transferFrom(msg.sender, address(this), _amount);

    if (!alreadyApprovedTokens[aave][_token]) {
      IERC20(_token).safeApprove(aave, type(uint).max);
    }

    ILendingPool(aave).deposit(_token, _amount, msg.sender, 0);
  }

  /// @notice Receives underlying aToken and sends ERC20 token to msg.sender
  /// @param _aToken underlying ERC20 token to withdraw
  /// @param _token ERC20 token to receive
  /// @param _amount Amount of token to withdraw and receive
  function withdraw(address _token, address _aToken, uint _amount) public payable {
    IERC20(_aToken).transferFrom(msg.sender, address(this), _amount);

    if (!alreadyApprovedTokens[aave][_token]) {
      IERC20(_token).safeApprove(aave, type(uint).max);
    }

    if (!alreadyApprovedTokens[aave][_aToken]) {
      IERC20(_aToken).safeApprove(aave, type(uint).max);
    }

    ILendingPool(aave).withdraw(address(_token), _amount, msg.sender);
  }

  /// @notice Withdraws fees and transfers them to owner
  function withdrawAdmin() public onlyOwner {
    require(address(this).balance > 0);

    payable(owner()).transfer(address(this).balance);
  }

  receive() external payable {}
}

