// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "./ILido.sol";
import "../Proxy.sol";
import "../interfaces/IWETH9.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Lido is Proxy {
    using SafeERC20 for IERC20;

    ILido public immutable lido;
    IWETH9 public immutable weth;

    constructor(Permit2 _permit2, ILido _lido, IWETH9 _weth) Proxy(_permit2) {
        lido = _lido;
        weth = _weth;
    }

    /// @notice Unwraps WETH to ETH
    function unwrapWETH9() private {
        uint256 balanceWETH9 = weth.balanceOf(address(this));

        if (balanceWETH9 > 0) {
            weth.withdraw(balanceWETH9);
        }
    }

    /// @notice Sweeps contract tokens to msg.sender
    function sweepToken(IERC20 _token) private {
        uint256 balanceOf = _token.balanceOf(address(this));

        _token.safeTransfer(msg.sender, balanceOf);
    }

    /// @notice Sweeps all ST_ETH tokens of the contract based on shares to msg.sender
    /// @dev This function uses sharesOf instead of balanceOf to transfer 100% of tokens
    function sweepSteth() private {
        uint256 shares = lido.sharesOf(address(this));

        lido.transferShares(msg.sender, shares);
    }

    /// @notice Submits ETH to Lido protocol and transfers ST_ETH to msg.sender
    /// @param _proxyFee Fee of the proxy contract
    /// @return steth Amount of ST_ETH token that is being transferred to msg.sender
    function supply(uint256 _proxyFee) external payable returns (uint256 steth) {
        steth = lido.submit{value: msg.value - _proxyFee}(msg.sender);

        sweepSteth();
    }

    /// @notice Submits WETH to Lido protocol and transfers ST_ETH to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct
    /// @param _signature Signature, used by Permit2
    /// @return steth Amount of ST_ETH token that is being transferred to msg.sender
    function supplyWeth(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        external
        payable
        returns (uint256 steth)
    {
        require(_permit.permitted.token == address(weth));

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        // Unwrap WETH to ETH
        unwrapWETH9();

        steth = lido.submit{value: _permit.permitted.amount}(msg.sender);

        sweepSteth();
    }
}
