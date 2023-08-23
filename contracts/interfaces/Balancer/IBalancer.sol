// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
pragma abicoder v2;

import {IVault, IAsset} from "./IVault.sol";

/**
 * @title Balancer proxy contract
 * @author Pino development team
 * @notice Deposits and Withdraws ERC20/ETH tokens to the vault and handles swap functions
 * @dev This contract uses Permit2
 */
interface IBalancer {
    struct JoinPoolParams {
        bytes32 poolId;
        bytes userData;
        IAsset[] assets;
        address recipient;
        uint256[] maxAmountsIn;
    }

    /**
     * @dev called by users to join a pool, which transfers tokens from `msg.sender` into the pool's balance. this will
     * trigger custom pool behavior, which will typically grant something in return to `msg.sender` - often tokenized
     * pool shares.
     *
     * the `assets` and `maxamountsin` arrays must have the same length, and each entry indicates the maximum amount
     * to send for each asset. the amounts to send are decided by the pool and not the vault: it just enforces
     * these maximums.
     *
     * if joining a pool that holds weth, it is possible to send eth directly: the vault will do the wrapping. to enable
     * this mechanism, the iasset sentinel value (the zero address) must be passed in the `assets` array instead of the
     * weth address. note that it is not possible to combine eth and weth in the same join. any excess eth will be sent
     * back to the caller (not the sender, which is important for relayers).
     *
     * `assets` must have the same length and order as the array returned by `getpooltokens`. this prevents issues when
     * interacting with pools that register and deregister tokens frequently. if sending eth however, the array must be
     * sorted *before* replacing the weth address with the eth sentinel value (the zero address), which means the final
     * `assets` array might not be sorted. pools with no registered tokens cannot be joined.
     *
     * this causes the vault to call the `ibasepool.onjoinpool` hook on the pool's contract, where pools implement
     * their own custom logic. this typically requires additional information from the user (such as the expected number
     * of pool shares). this can be encoded in the `userdata` argument, which is ignored by the vault and passed
     * directly to the pool's contract, as is `recipient`.
     *
     * emits a `poolbalancechanged` event.
     */
    function joinPool(JoinPoolParams calldata _params) external payable;

    struct ExitPoolParams {
        bytes32 poolId;
        bytes userData;
        IAsset[] assets;
        address recipient;
        uint256[] minAmountsOut;
    }

    /**
     * @dev Called by users to exit a Pool, which transfers tokens from the Pool's balance to `recipient`. This will
     * trigger custom Pool behavior, which will typically ask for something in return from `sender` - often tokenized
     * Pool shares. The amount of tokens that can be withdrawn is limited by the Pool's `cash` balance (see
     * `getPoolTokenInfo`).
     *
     * If the caller is not `sender`, it must be an authorized relayer for them.
     *
     * The `tokens` and `minAmountsOut` arrays must have the same length, and each entry in these indicates the minimum
     * token amount to receive for each token contract. The amounts to send are decided by the Pool and not the Vault:
     * it just enforces these minimums.
     *
     * If exiting a Pool that holds WETH, it is possible to receive ETH directly: the Vault will do the unwrapping. To
     * enable this mechanism, the IAsset sentinel value (the zero address) must be passed in the `assets` array instead
     * of the WETH address. Note that it is not possible to combine ETH and WETH in the same exit.
     *
     * `assets` must have the same length and order as the array returned by `getPoolTokens`. This prevents issues when
     * interacting with Pools that register and deregister tokens frequently. If receiving ETH however, the array must
     * be sorted *before* replacing the WETH address with the ETH sentinel value (the zero address), which means the
     * final `assets` array might not be sorted. Pools with no registered tokens cannot be exited.
     *
     * If `toInternalBalance` is true, the tokens will be deposited to `recipient`'s Internal Balance. Otherwise,
     * an ERC20 transfer will be performed. Note that ETH cannot be deposited to Internal Balance: attempting to
     * do so will trigger a revert.
     *
     * `minAmountsOut` is the minimum amount of tokens the user expects to get out of the Pool, for each token in the
     * `tokens` array. This array must match the Pool's registered tokens.
     *
     * This causes the Vault to call the `IBasePool.onExitPool` hook on the Pool's contract, where Pools implement
     * their own custom logic. This typically requires additional information from the user (such as the expected number
     * of Pool shares to return). This can be encoded in the `userData` argument, which is ignored by the Vault and
     * passed directly to the Pool's contract.
     *
     * Emits a `PoolBalanceChanged` event.
     */
    function exitPool(ExitPoolParams calldata _params) external payable;

    struct SwapParams {
        bytes32 poolId;
        IAsset assetIn;
        IAsset assetOut;
        uint256 limit;
        uint256 amount;
        bytes userData;
        address recipient;
        IVault.SwapKind kind;
    }

    /**
     * @dev Performs a swap with a single Pool.
     *
     * If the swap is 'given in' (the number of tokens to send to the Pool is known), it returns the amount of tokens
     * taken from the Pool, which must be greater than or equal to `limit`.
     *
     * If the swap is 'given out' (the number of tokens to take from the Pool is known), it returns the amount of tokens
     * sent to the Pool, which must be less than or equal to `limit`.
     *
     * Internal Balance usage and the recipient are determined by the `funds` struct.
     *
     * Emits a `Swap` event.
     */
    function swap(SwapParams calldata _params) external payable;

    struct BatchSwapParams {
        IAsset[] assets;
        int256[] limits;
        address recipient;
        IVault.SwapKind kind;
        IVault.BatchSwapStep[] swaps;
    }

    /**
     * @dev Performs a series of swaps with one or multiple Pools. In each individual swap, the caller determines either
     * the amount of tokens sent to or received from the Pool, depending on the `kind` value.
     *
     * Returns an array with the net Vault asset balance deltas. Positive amounts represent tokens (or ETH) sent to the
     * Vault, and negative amounts represent tokens (or ETH) sent by the Vault. Each delta corresponds to the asset at
     * the same index in the `assets` array.
     *
     * Swaps are executed sequentially, in the order specified by the `swaps` array. Each array element describes a
     * Pool, the token to be sent to this Pool, the token to receive from it, and an amount that is either `amountIn` or
     * `amountOut` depending on the swap kind.
     *
     * Multihop swaps can be executed by passing an `amount` value of zero for a swap. This will cause the amount in/out
     * of the previous swap to be used as the amount in for the current one. In a 'given in' swap, 'tokenIn' must equal
     * the previous swap's `tokenOut`. For a 'given out' swap, `tokenOut` must equal the previous swap's `tokenIn`.
     *
     * The `assets` array contains the addresses of all assets involved in the swaps. These are either token addresses,
     * or the IAsset sentinel value for ETH (the zero address). Each entry in the `swaps` array specifies tokens in and
     * out by referencing an index in `assets`. Note that Pools never interact with ETH directly: it will be wrapped to
     * or unwrapped from WETH by the Vault.
     *
     * Internal Balance usage, sender, and recipient are determined by the `funds` struct. The `limits` array specifies
     * the minimum or maximum amount of each token the vault is allowed to transfer.
     *
     * `batchSwap` can be used to make a single swap, like `swap` does, but doing so requires more gas than the
     * equivalent `swap` call.
     *
     * Emits `Swap` events.
     */
    function batchSwap(IBalancer.BatchSwapParams calldata _params) external payable;
}
