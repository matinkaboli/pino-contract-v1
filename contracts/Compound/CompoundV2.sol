// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../Pino.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/Compound/IComet.sol";
import "../interfaces/Compound/ICToken.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Compound V2 proxy
/// @author Pino Development Team
/// @notice Calls Compound V2/V3 functions using permit2
/// @dev This contract uses Permit2
contract Compound is Pino {
    using SafeERC20 for IERC20;

    IComet public immutable Comet;

    /// @notice Receives tokens and cTokens and approves them
    /// @param _permit2 Address of Permit2 contract
    /// @param _weth Address of WETH9 contract
    /// @param _comet Address of CompoundV3 (comet) contract
    /// @param _tokens List of ERC20 tokens used in Compound V2
    /// @param _cTokens List of ERC20 cTokens used in Compound V2
    /// @dev Do not put WETH address among _tokens
    constructor(Permit2 _permit2, IWETH9 _weth, IComet _comet, IERC20[] memory _tokens, address[] memory _cTokens)
        Pino(_permit2, _weth)
    {
        Comet = _comet;

        _weth.approve(address(_comet), type(uint256).max);

        for (uint8 i = 0; i < _tokens.length;) {
            _tokens[i].safeApprove(_cTokens[i], type(uint256).max);
            _tokens[i].safeApprove(address(_comet), type(uint256).max);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Supplies an ERC20 asset to Compound
    /// @notice _cToken Address of the cToken
    function depositV2(uint256 _amount, ICToken _cToken, address _recipient) public payable {
        _cToken.mint(_amount);

        sweepToken(address(_cToken), _recipient);
    }

    /// @notice Supplies ETH to Compound
    /// @param _cToken address of cETH
    /// @param _proxyFee Fee of the proxy contract
    /// @param _recipient The destination address that will receive cTokens
    function depositETHV2(ICToken _cToken, uint256 _proxyFee, address _recipient) public payable ethUnlocked {
        _cToken.mint{value: msg.value - _proxyFee}();

        sweepToken(address(_cToken), _recipient);
    }

    /// @notice Converts cToken to token and transfers it to the recipient
    /// @param _cToken Address of the cToken
    /// @param _amount Amount to withdraw
    /// @param _recipient The destination that will receive the underlying token
    function withdrawV2(ICToken _cToken, uint256 _amount, address _recipient) public payable {
        _cToken.redeem(_amount);

        sweepToken(_cToken.underlying(), _recipient);
    }

    /// @notice Receives cEther and unwraps it to ETH and transfers it to the recipient
    /// @param _cToken Address of the cToken
    /// @param _amount Amount to withdraw
    /// @param _recipient The destination address that will receive ETH
    function withdrawETHV2(ICToken _cToken, uint256 _amount, address _recipient) public payable ethUnlocked {
        uint256 balanceBefore = address(this).balance;

        _cToken.redeem(_amount);

        uint256 balanceAfter = address(this).balance;

        _sendETH(_recipient, balanceAfter - balanceBefore);
    }

    function depositV3(address _recipient, uint256 _amount, address _token) {
        Comet.supplyTo(_recipient, _token, _amount);
    }
}
