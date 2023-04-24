// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "./ILido.sol";
import "../Proxy.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/IWstETH.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Lido is Proxy {
    using SafeERC20 for IERC20;

    ILido public immutable StETH;
    IWETH9 public immutable WETH9;
    IWstETH public immutable WstETH;

    constructor(Permit2 _permit2, ILido _stETH, IWETH9 _weth9, IWstETH _wstETH) Proxy(_permit2) {
        WETH9 = _weth9;
        StETH = _stETH;
        WstETH = _wstETH;

        _stETH.approve(address(_wstETH), type(uint256).max);
    }

    /// @notice Unwraps WETH to ETH
    function unwrapWETH9() private {
        uint256 balanceWETH9 = WETH9.balanceOf(address(this));

        if (balanceWETH9 > 0) {
            WETH9.withdraw(balanceWETH9);
        }
    }

    /// @notice Sweeps contract tokens to msg.sender
    function sweepToken(IERC20 _token) private {
        uint256 balanceOf = _token.balanceOf(address(this));

        _token.safeTransfer(msg.sender, balanceOf);
    }

    /// @notice Sweeps all ST_ETH tokens of the contract based on shares to msg.sender
    /// @dev This function uses sharesOf instead of balanceOf to transfer 100% of tokens
    function sweepStETH() private {
        uint256 shares = StETH.sharesOf(address(this));

        StETH.transferShares(msg.sender, shares);
    }

    /// @notice Submits ETH to Lido protocol and transfers ST_ETH to msg.sender
    /// @param _proxyFee Fee of the proxy contract
    /// @return steth Amount of ST_ETH token that is being transferred to msg.sender
    function ethToStETH(uint256 _proxyFee) external payable returns (uint256 steth) {
        steth = StETH.submit{value: msg.value - _proxyFee}(msg.sender);

        sweepStETH();
    }

    /// @notice Converts ETH to WST_ETH and transfers WST_ETH to msg.sender
    /// @param _proxyFee Fee of the proxy contract
    function ethToWstETH(uint256 _proxyFee) external payable {
        (bool sent,) = address(WstETH).call{value: msg.value - _proxyFee}("");
        require(sent, "Failed to send Ether");

        sweepToken(IERC20(address(WstETH)));
    }

    /// @notice Submits WETH to Lido protocol and transfers ST_ETH to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct
    /// @param _signature Signature, used by Permit2
    /// @return steth Amount of ST_ETH token that is being transferred to msg.sender
    function wethToStETH(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        external
        payable
        returns (uint256 steth)
    {
        require(_permit.permitted.token == address(WETH9));

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        unwrapWETH9();

        steth = StETH.submit{value: _permit.permitted.amount}(msg.sender);

        sweepStETH();
    }

    /// @notice Submits WETH to Lido protocol and transfers WST_ETH to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct
    /// @param _signature Signature, used by Permit2
    function wethToWstETH(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        external
        payable
    {
        require(_permit.permitted.token == address(WETH9));

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        unwrapWETH9();

        (bool sent,) = address(WstETH).call{value: _permit.permitted.amount - msg.value}("");
        require(sent, "Failed to send Ether");

        sweepToken(IERC20(address(WstETH)));
    }

    /// @notice Wraps ST_ETH to WST_ETH and transfers it to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct
    /// @param _signature Signature, used by Permit2
    function stETHToWstETH(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        external
        payable
    {
        require(_permit.permitted.token == address(StETH));

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        WstETH.wrap(_permit.permitted.amount);
        sweepToken(IERC20(address(WstETH)));
    }

    /// @notice Unwraps WST_ETH to ST_ETH and transfers it to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct
    /// @param _signature Signature, used by Permit2
    function wstETHToStETH(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        external
        payable
    {
        require(_permit.permitted.token == address(WstETH));

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        WstETH.unwrap(_permit.permitted.amount);
        sweepStETH();
    }
}
