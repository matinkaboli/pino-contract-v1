// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Pino} from "../../base/Pino.sol";
import {Permit2} from "../../Permit2/Permit2.sol";
import {IERC20} from "../../interfaces/token/IERC20.sol";
import {IWETH9} from "../../interfaces/token/IWETH9.sol";
import {IComet} from "../../interfaces/Compound/IComet.sol";
import {ICToken} from "../../interfaces/Compound/ICToken.sol";
import {ICEther} from "../../interfaces/Compound/ICEther.sol";
import {ICompound} from "../../interfaces/Compound/ICompound.sol";
import {ISignatureTransfer} from "../../Permit2/ISignatureTransfer.sol";

/**
 * @title Compound V2 proxy
 * @author Pino development team
 * @notice Calls Compound V2/V3 functions
 * @dev This contract uses Permit2
 */
contract Compound is ICompound, Pino {
    IComet public immutable Comet;
    ICEther public immutable CEther;

    /**
     * @notice Receives tokens and cTokens and approves them
     * @param _permit2 Address of Permit2 contract
     * @param _weth Address of WETH9 contract
     * @param _comet Address of CompoundV3 (comet) contract
     * @param _cEther Address of Compound V2 CEther
     */
    constructor(Permit2 _permit2, IWETH9 _weth, IComet _comet, ICEther _cEther) Pino(_permit2, _weth) {
        Comet = _comet;
        CEther = _cEther;

        _approve(_weth, address(_comet));
    }

    /**
     * @notice Deposits ERC20 to the Compound protocol and transfers cTokens to the recipient
     * @param _amount Amount to deposit
     * @param _cToken Address of the cToken to receive
     * @param _recipient The destination address that will receive cTokens
     */
    function depositV2(uint256 _amount, ICToken _cToken, address _recipient) external payable {
        _cToken.mint(_amount);

        // Send cTokens to the recipient
        sweepToken(_cToken, _recipient);
    }

    /**
     * @notice Deposits ETH to the Compound protocol and transfers CEther to the recipient
     * @param _recipient The destination address that will receive cTokens
     * @param _proxyFee Fee of the proxy contract
     * @dev _proxyFee uses uint96 for storage efficiency
     */
    function depositETHV2(address _recipient, uint96 _proxyFee) external payable ethUnlocked {
        CEther.mint{value: msg.value - _proxyFee}();

        // Send CEther tokens to the recipient
        sweepToken(CEther, _recipient);
    }

    /**
     * @notice Deposits WETH, converts it to ETH and mints CEther
     * @param _permit permit structure to receive WETH
     * @param _signature Signature used by permit2
     * @param _recipient The destination address that will receive CEther
     */
    function depositWETHV2(
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature,
        address _recipient
    ) external payable {
        // Transfer WETH to the proxy contract
        permitTransferFrom(_permit, _signature);

        // Unwrap WETH to ETH
        WETH.withdraw(_permit.permitted.amount);

        // Mint CEther using ETH
        CEther.mint{value: _permit.permitted.amount}();

        // Transfer CEther to the recipient
        sweepToken(CEther, _recipient);
    }

    /**
     * @notice Deposits cTokens back to the Compound protocol
     *   and receives underlying ERC20 tokens and transfers it to the recipient
     * @param _amount Amount to withdraw
     * @param _cToken Address of the cToken
     * @param _recipient The destination that will receive the underlying token
     */
    function withdrawV2(uint256 _amount, ICToken _cToken, address _recipient) external payable {
        _cToken.redeem(_amount);

        // Send underlying ERC20 tokens to the recipient
        sweepToken(IERC20(_cToken.underlying()), _recipient);
    }

    /**
     * @notice Deposits CEther back the the Compound protocol and receives ETH and transfers it to the recipient
     * @param _amount Amount to withdraw
     * @param _recipient The destination address that will receive ETH
     */
    function withdrawETHV2(uint256 _amount, address _recipient) external payable ethUnlocked {
        uint256 balanceBefore = address(this).balance;

        // Contract will receive ETH and the balance is updated
        CEther.redeem(_amount);

        uint256 balanceAfter = address(this).balance;

        // Send ETH to the recipient
        _sendETH(_recipient, balanceAfter - balanceBefore);
    }

    /**
     * @notice Deposits CEther back the the Compound protocol and receives ETH and transfers WETH to the recipient
     * @param _amount Amount to withdraw
     * @param _recipient The destination address that will receive WETH
     */
    function withdrawWETHV2(uint256 _amount, address _recipient) external payable ethUnlocked {
        uint256 balanceBefore = address(this).balance;

        // Contract will receive ETH and the balance is updated
        CEther.redeem(_amount);

        uint256 balanceAfter = address(this).balance;

        // Convert ETH to WETH
        WETH.deposit{value: balanceAfter - balanceBefore}();

        // Send WETH to the recipient
        sweepToken(WETH, _recipient);
    }

    /**
     * @notice Repays a borrowed token on behalf of the recipient
     * @param _cToken Address of the cToken
     * @param _amount Amount to repay
     * @param _recipient The address of the recipient
     */
    function repayV2(ICToken _cToken, uint256 _amount, address _recipient) external payable {
        _cToken.repayBorrowBehalf(_recipient, _amount);
    }

    /**
     * @notice Repays ETH on behalf of the recipient
     * @param _recipient The address of the recipient
     * @param _proxyFee Fee of the proxy contract
     */
    function repayETHV2(address _recipient, uint96 _proxyFee) external payable ethUnlocked {
        CEther.repayBorrowBehalf{value: msg.value - _proxyFee}(_recipient);
    }

    /**
     * @notice Repays ETH on behalf of the recipient but receives WETH from the caller
     * @param _permit The permit structure for PERMIT2 to receive WETH
     * @param _signature The signature used by PERMIT2 contract
     * @param _recipient The address of the recipient
     */
    function repayWETHV2(
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature,
        address _recipient
    ) external payable ethUnlocked {
        // Transfer WETH to the contract
        permitTransferFrom(_permit, _signature);

        // Unwrap WETH to ETH
        WETH.withdraw(_permit.permitted.amount);

        // Send ETH to CEther
        CEther.repayBorrowBehalf{value: _permit.permitted.amount}(_recipient);
    }

    /**
     * @notice Deposits ERC20 tokens to the Compound protocol on behalf of the recipient
     * @param _token The underlying ERC20 token
     * @param _amount Amount to deposit
     * @param _recipient The address of the recipient
     */
    function depositV3(address _token, uint256 _amount, address _recipient) external payable {
        Comet.supplyTo(_recipient, _token, _amount);
    }

    /**
     * @notice Withdraws an ERC20 token and transfers it to the recipient
     * @param _token The underlying ERC20 token to withdraw
     * @param _amount Amount to withdraw
     * @param _recipient The address of the recipient
     */
    function withdrawV3(address _token, uint256 _amount, address _recipient) external payable {
        Comet.withdrawFrom(msg.sender, _recipient, _token, _amount);
    }
}
