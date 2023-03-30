// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "../Proxy.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IWETH9.sol";

/// @title Balancer proxy contract
/// @author Matin Kaboli
/// @notice Deposits and Withdraws ERC20/ETH tokens to the vault and handles swap functions
/// @dev This contract uses Permit2
contract Balancer is Proxy {
    using SafeERC20 for IERC20;

    IVault immutable vault;

    /// @notice Sets Balancer Vault address and approves assets to it
    /// @param _permit2 Permit2 contract address
    /// @param _vault Balancer Vault contract address
    /// @param _tokens ERC20 tokens, they're approved beforehand
    constructor(Permit2 _permit2, IVault _vault, IERC20[] memory _tokens) Proxy(_permit2) {
        vault = _vault;

        for (uint256 i = 0; i < _tokens.length;) {
            _tokens[i].safeApprove(address(_vault), type(uint256).max);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Approves ERC20 tokens to Balancer Vault contract
    /// @param _token ERC20 token to be approved
    function approveToken(IERC20 _token) public {
        _token.safeApprove(address(vault), type(uint256).max);
    }

    /**
     * @dev Called by users to join a Pool, which transfers tokens from `msg.sender` into the Pool's balance. This will
     * trigger custom Pool behavior, which will typically grant something in return to `msg.sender` - often tokenized
     * Pool shares.
     *
     * The `assets` and `maxAmountsIn` arrays must have the same length, and each entry indicates the maximum amount
     * to send for each asset. The amounts to send are decided by the Pool and not the Vault: it just enforces
     * these maximums.
     *
     * If joining a Pool that holds WETH, it is possible to send ETH directly: the Vault will do the wrapping. To enable
     * this mechanism, the IAsset sentinel value (the zero address) must be passed in the `assets` array instead of the
     * WETH address. Note that it is not possible to combine ETH and WETH in the same join. Any excess ETH will be sent
     * back to the caller (not the sender, which is important for relayers).
     *
     * `assets` must have the same length and order as the array returned by `getPoolTokens`. This prevents issues when
     * interacting with Pools that register and deregister tokens frequently. If sending ETH however, the array must be
     * sorted *before* replacing the WETH address with the ETH sentinel value (the zero address), which means the final
     * `assets` array might not be sorted. Pools with no registered tokens cannot be joined.
     *
     * This causes the Vault to call the `IBasePool.onJoinPool` hook on the Pool's contract, where Pools implement
     * their own custom logic. This typically requires additional information from the user (such as the expected number
     * of Pool shares). This can be encoded in the `userData` argument, which is ignored by the Vault and passed
     * directly to the Pool's contract, as is `recipient`.
     *
     * Emits a `PoolBalanceChanged` event.
     */
    function joinPool(
        bytes32 _poolId,
        bytes calldata _userData,
        IAsset[] calldata _assets,
        uint256[] calldata _maxAmountsIn,
        uint16 _proxyFee,
        ISignatureTransfer.PermitBatchTransferFrom calldata _permit,
        bytes calldata _signature
    ) external payable {
        uint256 permitLength = _permit.permitted.length;

        ISignatureTransfer.SignatureTransferDetails[] memory details =
            new ISignatureTransfer.SignatureTransferDetails[](permitLength);

        for (uint8 i = 0; i < permitLength;) {
            details[i].to = address(this);
            details[i].requestedAmount = _permit.permitted[i].amount;

            unchecked {
                ++i;
            }
        }

        permit2.permitTransferFrom(_permit, details, msg.sender, _signature);

        IVault.JoinPoolRequest memory poolRequest = IVault.JoinPoolRequest({
            assets: _assets,
            userData: _userData,
            fromInternalBalance: false,
            maxAmountsIn: _maxAmountsIn
        });

        vault.joinPool{value: msg.value - _proxyFee}(_poolId, address(this), msg.sender, poolRequest);
    }

    /**
     * @dev Called by users to join a Pool, which transfers tokens from `msg.sender` into the Pool's balance. This will
     * trigger custom Pool behavior, which will typically grant something in return to `msg.sender` - often tokenized
     * Pool shares.
     *
     * The `assets` and `maxAmountsIn` arrays must have the same length, and each entry indicates the maximum amount
     * to send for each asset. The amounts to send are decided by the Pool and not the Vault: it just enforces
     * these maximums.
     *
     * If joining a Pool that holds WETH, it is possible to send ETH directly: the Vault will do the wrapping. To enable
     * this mechanism, the IAsset sentinel value (the zero address) must be passed in the `assets` array instead of the
     * WETH address. Note that it is not possible to combine ETH and WETH in the same join. Any excess ETH will be sent
     * back to the caller (not the sender, which is important for relayers).
     *
     * `assets` must have the same length and order as the array returned by `getPoolTokens`. This prevents issues when
     * interacting with Pools that register and deregister tokens frequently. If sending ETH however, the array must be
     * sorted *before* replacing the WETH address with the ETH sentinel value (the zero address), which means the final
     * `assets` array might not be sorted. Pools with no registered tokens cannot be joined.
     *
     * This causes the Vault to call the `IBasePool.onJoinPool` hook on the Pool's contract, where Pools implement
     * their own custom logic. This typically requires additional information from the user (such as the expected number
     * of Pool shares). This can be encoded in the `userData` argument, which is ignored by the Vault and passed
     * directly to the Pool's contract, as is `recipient`.
     *
     * Emits a `PoolBalanceChanged` event.
     */
    function joinPoolETH(
        bytes32 _poolId,
        bytes calldata _userData,
        IAsset[] calldata _assets,
        uint256[] calldata _maxAmountsIn,
        uint16 _proxyFee
    ) external payable {
        IVault.JoinPoolRequest memory poolRequest = IVault.JoinPoolRequest({
            assets: _assets,
            userData: _userData,
            fromInternalBalance: false,
            maxAmountsIn: _maxAmountsIn
        });

        vault.joinPool{value: msg.value - _proxyFee}(_poolId, address(this), msg.sender, poolRequest);
    }

    /// @notice Swaps a token for another token in a pool
    /// @param _poolId Pool id
    /// @param _assetOut Expected token out address
    /// @param _limit The minimum amount of expected token out
    /// @param _userData User data structure, can be left empty
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    function swap(
        bytes32 _poolId,
        IAsset _assetOut,
        uint256 _limit,
        bytes calldata _userData,
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature
    ) external payable {
        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        IVault.SingleSwap memory singleSwap = IVault.SingleSwap({
            poolId: _poolId,
            kind: IVault.SwapKind.GIVEN_IN,
            assetIn: IAsset(_permit.permitted.token),
            assetOut: _assetOut,
            amount: _permit.permitted.amount,
            userData: _userData
        });

        IVault.FundManagement memory funds = IVault.FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(msg.sender),
            toInternalBalance: false
        });

        vault.swap(singleSwap, funds, _limit, block.timestamp);
    }
}
