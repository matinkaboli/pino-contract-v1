// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
pragma abicoder v2;

import {Pino} from "../../base/Pino.sol";
import {Permit2} from "../../Permit2/Permit2.sol";
import {ISDai} from "../../interfaces/Invest/ISDai.sol";
import {ILido} from "../../interfaces/Invest/ILido.sol";
import {IWETH9} from "../../interfaces/token/IWETH9.sol";
import {IWstETH} from "../../interfaces/Invest/IWstETH.sol";
import {IInvest} from "../../interfaces/Invest/IInvest.sol";
import {ISignatureTransfer} from "../../Permit2/ISignatureTransfer.sol";

/**
 * @title Invest proxy contract
 * @author Pino development team
 * @notice Invests users tokens into Lido, Compound, Aave, and SavingsDai
 */
contract Invest is IInvest, Pino {
    ISDai public immutable SDai;
    ILido public immutable StETH;
    IWstETH public immutable WstETH;

    /**
     * @notice Lido proxy contract
     * @dev Lido and StETH contracts are the same
     * @param _permit2 Permit2 contract address
     * @param _weth WETH9 contract address
     * @param _stETH StETH contract address
     * @param _wstETH WstETH contract address
     * @param _sDai Savings Dai contract address
     */
    constructor(Permit2 _permit2, IWETH9 _weth, ILido _stETH, IWstETH _wstETH, ISDai _sDai) Pino(_permit2, _weth) {
        SDai = _sDai;
        StETH = _stETH;
        WstETH = _wstETH;

        // Approve WETH
        _weth.approve(address(_stETH), type(uint256).max);
        _weth.approve(address(_wstETH), type(uint256).max);
        _stETH.approve(address(_wstETH), type(uint256).max);
    }

    /**
     * @notice Sweeps all ST_ETH tokens of the contract based on shares to msg.sender
     * @dev This function uses sharesOf instead of balanceOf to transfer 100% of tokens
     */
    function sweepStETH(address _recipient) private {
        // Transfer shares of StETH to the recipient
        // This is more accurate than using a simple transfer function
        // Because StETH uses shares under the hood
        StETH.transferShares(_recipient, StETH.sharesOf(address(this)));
    }

    /**
     * @notice Sends ETH to the Lido protocol and transfers ST_ETH to the recipient
     * @param _proxyFeeInWei Fee of the proxy contract
     * @param _recipient The destination address that will receive ST_ETH
     * @return steth Amount of ST_ETH token that is being transferred to the recipient
     */
    function ethToStETH(address _recipient, uint96 _proxyFeeInWei)
        external
        payable
        ethUnlocked
        returns (uint256 steth)
    {
        // Transfer ETH to StETH contract and receive StETH
        steth = StETH.submit{value: msg.value - _proxyFeeInWei}(msg.sender);

        // Transfer all shares of StETH to the recipient
        sweepStETH(_recipient);
    }

    /**
     * @notice Converts ETH to WST_ETH and transfers WST_ETH to the recipient
     * @param _proxyFeeInWei Fee of the proxy contract
     * @param _recipient The destination address that will receive WST_ETH
     */
    function ethToWstETH(address _recipient, uint96 _proxyFeeInWei) external payable ethUnlocked {
        // Transfer ETH to WstETH contract and receive WstETH
        _sendETH(address(WstETH), msg.value - _proxyFeeInWei);

        // Transfer WstETH tokens to the recipient
        sweepToken(WstETH, _recipient);
    }

    /**
     * @notice Submits WETH to Lido protocol and transfers ST_ETH to the recipient
     * @param _permit Permit2 PermitTransferFrom struct
     * @param _signature Signature, used by Permit2
     * @param _recipient The destination address that will receive ST_ETH
     * @dev For security reasons, it is not possible to run functions
     * inside of this function separately through a multicall
     * @return steth Amount of ST_ETH token that is being transferred to msg.sender
     */
    function wethToStETH(
        address _recipient,
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature
    ) external payable ethUnlocked returns (uint256 steth) {
        // Transfer WETH to the contract
        permitTransferFrom(_permit, _signature);

        // Unwrap WETH to ETH
        WETH.withdraw(_permit.permitted.amount);

        // Convert ETH to StETH
        steth = StETH.submit{value: _permit.permitted.amount}(msg.sender);

        // Transfer all shares of StETH to the recipient
        sweepStETH(_recipient);
    }

    /**
     * @notice Submits WETH to Lido protocol and transfers WST_ETH to msg.sender
     * @param _recipient The destination address that will receive WST_ETH
     * @param _permit Permit2 PermitTransferFrom struct
     * @param _signature Signature, used by Permit2
     */
    function wethToWstETH(
        address _recipient,
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature
    ) external payable {
        // Transfer WETH to the contract
        permitTransferFrom(_permit, _signature);

        // Unwrap WETH to ETH
        WETH.withdraw(_permit.permitted.amount);

        // Convert ETH to WstETH
        _sendETH(address(WstETH), _permit.permitted.amount);

        // Transfer WstETH tokens to the recipient
        sweepToken(WstETH, _recipient);
    }

    /**
     * @notice Wraps ST_ETH to WST_ETH and transfers it to msg.sender
     * @param _amount Amount to convert to WST_ETH
     * @param _recipient The destination address that will receive WST_ETH
     */
    function stETHToWstETH(uint256 _amount, address _recipient) external payable {
        // Wraps StETH to WstETH
        WstETH.wrap(_amount);

        // Transfer WstETH tokens to the recipient
        sweepToken(WstETH, _recipient);
    }

    /**
     * @notice Unwraps WST_ETH to ST_ETH and transfers it to the recipient
     * @param _amount Amount of WstETH to unwrap
     * @param _recipient The destination address that will receive StETH
     */
    function wstETHToStETH(uint256 _amount, address _recipient) external payable {
        // Unwraps WstETH to StETH
        WstETH.unwrap(_amount);

        // Transfer all shares of StETH to the recipient
        sweepStETH(_recipient);
    }

    /**
     * @notice Transfers DAI to SavingsDai and transfers SDai to the recipient
     * @param _amount Amount of DAI to invest
     * @param _recipient The destination address that will receive StETH
     */
    function daiToSDai(uint256 _amount, address _recipient) external payable returns (uint256) {
        // Uses the DAI inside the proxy contract to send to the SDai contract
        uint256 deposited = SDai.deposit(_amount, _recipient);

        return deposited;
    }
}
