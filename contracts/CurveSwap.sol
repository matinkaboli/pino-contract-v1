// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "hardhat/console.sol";
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

  function exchange_multiple(
    address[9] memory _route,
    uint[3][4] memory _swap_params,
    uint _amount,
    uint _expected,
    address[4] memory _pools,
    address _receiver
  ) external payable returns (uint);
}

/// @title Curve swap proxy contract
/// @author Matin Kaboli
/// @notice Exchanges tokens from different pools
contract CurveSwap is Ownable {
  using SafeERC20 for IERC20;

  address immutable public swapContract;
  mapping (address => mapping (address => bool)) private alreadyApprovedTokens;

  /// @notice Receives swap contract address
  /// @param _swapContract Swap contract address
  constructor(address _swapContract) {
    swapContract = _swapContract;
  }

  /// @notice Exchanges 2 tokens using different pools
  /// @param from The sending IERC20 token 
  /// @param to The receiving IERC20 token 
  /// @param amount The amount of sending token
  /// @param expected The expected amount of receiving token (minimum amount)
  /// @return uint Amount received
  function exchange(address from, address to, uint amount, uint expected) external payable returns (uint) {
    IERC20(from).safeTransferFrom(msg.sender, address(this), amount);
  
    if (!alreadyApprovedTokens[from][swapContract]) {
      IERC20(from).approve(swapContract, type(uint).max);

      alreadyApprovedTokens[from][swapContract] = true;
    }

    uint swapped = ICurveSwap(swapContract).exchange_with_best_rate(from, to, amount, expected, msg.sender);

    return swapped;
  }

  /// @notice Perform up to four swaps in a single transaction
  /// @dev Routing and swap params must be determined off-chain. This functionality is designed for gas efficiency over ease-of-use.
  /// @param _route Array of [initial token, pool, token, pool, token, ...]
  /// The array is iterated until a pool address of 0x00, then the last
  /// given token is transferred to `_receiver`
  /// @param _amount The amount of `_route[0]` token being sent.
  /// @param _expected The minimum amount received after the final swap.
  /// @param _pools Array of pools for swaps via zap contracts. This parameter is only needed for
  /// Polygon meta-factories underlying swaps.
  /// @return Received amount of the final output token
  function exchange_multiple(
    address[9] memory _route,
    uint[3][4] memory _swap_params,
    uint _amount,
    uint _expected,
    address[4] memory _pools
  ) external payable returns (uint) {
    IERC20(_route[0]).safeTransferFrom(msg.sender, address(this), _amount);
    
    if (!alreadyApprovedTokens[_route[0]][swapContract]) {
      IERC20(_route[0]).safeApprove(swapContract, type(uint).max);

      alreadyApprovedTokens[_route[0]][swapContract] = true;
    }

    ICurveSwap(swapContract).exchange_multiple(_route, _swap_params, _amount, _expected, _pools, msg.sender);

    return 1;
  }

  /// @notice Withdraws fees and transfers them to owner
  function withdrawAdmin() public onlyOwner {
    require(address(this).balance > 0);

    payable(owner()).transfer(address(this).balance);
  }
}
