// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
pragma abicoder v2;

import {ISignatureTransfer} from "../../Permit2/ISignatureTransfer.sol";

/**
 * @title Invest proxy contract
 * @author Pino development team
 * @notice Invests users tokens into Lido, Compound, Aave, and SavingsDai
 */
interface IInvest {
    /**
     * @notice Sends ETH to the Lido protocol and transfers ST_ETH to the recipient
     * @param _proxyFeeInWei Fee of the proxy contract
     * @param _recipient The destination address that will receive ST_ETH
     * @return steth Amount of ST_ETH token that is being transferred to the recipient
     */
    function ethToStETH(address _recipient, uint96 _proxyFeeInWei) external payable returns (uint256 steth);

    /**
     * @notice Converts ETH to WST_ETH and transfers WST_ETH to the recipient
     * @param _proxyFeeInWei Fee of the proxy contract
     * @param _recipient The destination address that will receive WST_ETH
     */
    function ethToWstETH(address _recipient, uint96 _proxyFeeInWei) external payable;

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
    ) external payable returns (uint256 steth);

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
    ) external payable;

    /**
     * @notice Wraps ST_ETH to WST_ETH and transfers it to msg.sender
     * @param _amount Amount to convert to WST_ETH
     * @param _recipient The destination address that will receive WST_ETH
     */
    function stETHToWstETH(uint256 _amount, address _recipient) external payable;

    /**
     * @notice Unwraps WST_ETH to ST_ETH and transfers it to the recipient
     * @param _amount Amount of WstETH to unwrap
     * @param _recipient The destination address that will receive StETH
     */
    function wstETHToStETH(uint256 _amount, address _recipient) external payable;

    /**
     * @notice Transfers DAI to SavingsDai and transfers SDai to the recipient
     * @param _amount Amount of DAI to invest
     * @param _recipient The destination address that will receive StETH
     */
    function daiToSDai(uint256 _amount, address _recipient) external payable returns (uint256);
}
