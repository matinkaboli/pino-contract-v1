// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "../Pino.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/Lido/ILido.sol";
import "../interfaces/Lido/IWstETH.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Lido proxy contract
/// @author Pino Development Team
/// @notice Converts ETH and WETH to ST_ETH and WST_ETH
/// @dev This contract uses Permit2
contract Lido is Pino {
    using SafeERC20 for IERC20;

    ILido public immutable StETH;
    IWstETH public immutable WstETH;

    /// @notice Lido proxy contract
    /// @dev Lido and StETH contracts are the same
    /// @param _permit2 Permit2 contract address
    /// @param _weth WETH9 contract address
    /// @param _stETH StETH contract address
    /// @param _wstETH WstETH contract address
    constructor(Permit2 _permit2, IWETH9 _weth, ILido _stETH, IWstETH _wstETH) Pino(_permit2, _weth) {
        StETH = _stETH;
        WstETH = _wstETH;

        _weth.approve(address(_stETH), type(uint256).max);
        _weth.approve(address(_wstETH), type(uint256).max);
        _stETH.approve(address(_wstETH), type(uint256).max);
    }

    /// @notice Sweeps all ST_ETH tokens of the contract based on shares to msg.sender
    /// @dev This function uses sharesOf instead of balanceOf to transfer 100% of tokens
    function sweepStETH(address _recipient) private {
        StETH.transferShares(_recipient, StETH.sharesOf(address(this)));
    }

    /// @notice Sends ETH to the Lido protocol and transfers ST_ETH to the recipient
    /// @param _proxyFee Fee of the proxy contract
    /// @param _recipient The destination address that will receive ST_ETH
    /// @return steth Amount of ST_ETH token that is being transferred to the recipient
    function ethToStETH(uint256 _proxyFee, address _recipient) external payable returns (uint256 steth) {
        steth = StETH.submit{value: msg.value - _proxyFee}(msg.sender);

        sweepStETH(_recipient);
    }

    /// @notice Converts ETH to WST_ETH and transfers WST_ETH to the recipient
    /// @param _proxyFee Fee of the proxy contract
    /// @param _recipient The destination address that will receive WST_ETH
    function ethToWstETH(uint256 _proxyFee, address _recipient) external payable {
        _sendETH(address(WstETH), msg.value - _proxyFee);

        sweepToken(address(WstETH), _recipient);
    }

    /// @notice Submits WETH to Lido protocol and transfers ST_ETH to the recipient
    /// @param _permit Permit2 PermitTransferFrom struct
    /// @param _signature Signature, used by Permit2
    /// @param _recipient The destination address that will receive ST_ETH
    /// @dev For security reasons, it is not possible to run functions inside of this function separately through a multicall
    /// @return steth Amount of ST_ETH token that is being transferred to msg.sender
    function wethToStETH(address _recipient, ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        external
        payable
        returns (uint256 steth)
    {
        require(_permit.permitted.token == address(WETH));

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        WETH.withdraw(_permit.permitted.amount);

        steth = StETH.submit{value: _permit.permitted.amount}(msg.sender);

        sweepStETH(_recipient);
    }

    /// @notice Submits WETH to Lido protocol and transfers WST_ETH to msg.sender
    /// @param _recipient The destination address that will receive WST_ETH
    /// @param _permit Permit2 PermitTransferFrom struct
    /// @param _signature Signature, used by Permit2
    function wethToWstETH(address _recipient, ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        external
        payable
    {
        require(_permit.permitted.token == address(WETH));

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        WETH.withdraw(_permit.permitted.amount);

        _sendETH(address(WstETH), _permit.permitted.amount);
        sweepToken(address(WstETH), _recipient);
    }

    /// @notice Wraps ST_ETH to WST_ETH and transfers it to msg.sender
    /// @param _amount Amount to convert to WST_ETH
    /// @param _recipient The destination address that will receive WST_ETH
    function stETHToWstETH(uint256 _amount, address _recipient)
        external
        payable
    {
        WstETH.wrap(_amount);

        sweepToken(address(WstETH), _recipient);
    }

    /// @notice Unwraps WST_ETH to ST_ETH and transfers it to the recipient
    function wstETHToStETH(uint256 _amount, address _recipient)
        external
        payable
    {
        WstETH.unwrap(_amount);

        sweepStETH(_recipient);
    }
}
