// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "../IWETH9.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IComet is IERC20 {
    function supplyTo(address dst, address asset, uint256 amount) external;
    function withdrawFrom(address src, address dst, address asset, uint256 amount) external;
}

/// @title Comet (Compound V3) proxy, similar to bulker contract
/// @author Matin Kaboli
/// @notice Supplies and Withdraws ERC20 and ETH tokens and helps with WETH wrapping
contract Comet is Ownable {
    using SafeERC20 for IERC20;

    address public weth;
    address public comet;
    mapping(address => mapping(address => bool)) private alreadyApprovedTokens;

    error FailedToSendEther();

    /// @notice Receives cUSDCv3 and approves Compoound tokens to it
    /// @param _comet cUSDCv3 address, used for supplying and withdrawing tokens
    /// @param _weth WETH address used in Comet protocol
    /// @param _tokens List of ERC20 tokens used in Compound V3
    constructor(address _comet, address _weth, address[] memory _tokens) {
        weth = _weth;
        comet = _comet;

        for (uint8 i = 0; i < _tokens.length; i += 1) {
            IERC20(_tokens[i]).safeApprove(_comet, type(uint256).max);

            alreadyApprovedTokens[_comet][_tokens[i]] = true;
        }

        if (!alreadyApprovedTokens[_comet][_weth]) {
            IERC20(_weth).safeApprove(_comet, type(uint256).max);

            alreadyApprovedTokens[_comet][_weth] = true;
        }
    }

    /// @notice Supplies an ERC20 asset to Comet
    /// @param _asset ERC20 asset address to supply
    /// @param _amount Amount of _asset to supply
    function supply(address _asset, uint256 _amount) public payable {
        IERC20(_asset).transferFrom(msg.sender, address(this), _amount);

        if (!alreadyApprovedTokens[comet][_asset]) {
            IERC20(_asset).safeApprove(comet, _amount);

            alreadyApprovedTokens[comet][_asset] = true;
        }

        IComet(comet).supplyTo(msg.sender, _asset, _amount);
    }

    /// @notice Wraps ETH to WETH and supplies it to Comet
    /// @param _fee Fee of the proxy
    function supplyETH(uint256 _fee) public payable {
        require(msg.value > 0 && msg.value > _fee);

        uint256 ethAmount = msg.value - _fee;

        IWETH9(payable(weth)).deposit{value: ethAmount}();
        IComet(comet).supplyTo(msg.sender, weth, ethAmount);
    }

    /// @notice Withdraws an ERC20 token and transfers it to msg.sender
    /// @param _asset ERC20 asset to withdraw
    /// @param _amount Amount of _asset to withdraw
    function withdraw(address _asset, uint256 _amount) public payable {
        IComet(comet).withdrawFrom(msg.sender, msg.sender, _asset, _amount);
    }

    /// @notice Withdraws WETH and unwraps it to ETH and transfers it to msg.sender
    /// @param _amount Amount of WETh to withdraw
    function withdrawETH(uint256 _amount) public payable {
        IComet(comet).withdrawFrom(msg.sender, address(this), weth, _amount);
        IWETH9(payable(weth)).withdraw(_amount);

        (bool success,) = msg.sender.call{value: _amount}("");
        if (!success) revert FailedToSendEther();
    }

    /// @notice Withdraws fees and transfers them to owner
    function withdrawAdmin() public onlyOwner {
        require(address(this).balance > 0);

        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
