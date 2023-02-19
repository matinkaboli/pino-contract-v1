// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "../Proxy.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/IUniversalRouter.sol";
import "../interfaces/INonfungiblePositionManager.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract Uniswap is IERC721Receiver, Proxy {
    using SafeERC20 for IERC20;

    struct Deposit {
        address owner;
        uint128 liquidity;
        address token0;
        address token1;
    }

    event DepositCreated(address owner, uint256 tokenId);

    address public immutable weth;
    ISwapRouter public immutable swapRouter;
    IUniversalRouter public immutable universalRouter;
    INonfungiblePositionManager public immutable nonfungiblePositionManager;

    mapping(uint256 => Deposit) public deposits;
    mapping(address => mapping(address => bool)) public alreadyApprovedTokens;

    constructor(
        ISwapRouter _swapRouter,
        Permit2 _permit2,
        INonfungiblePositionManager _nfpm,
        address _weth,
        IUniversalRouter _universalRouter,
        IERC20[] memory _tokens
    ) Proxy(_permit2) {
        weth = _weth;
        swapRouter = _swapRouter;
        nonfungiblePositionManager = _nfpm;
        universalRouter = _universalRouter;

        for (uint8 i = 0; i < _tokens.length; ++i) {
            _tokens[i].safeApprove(address(_nfpm), type(uint256).max);
            _tokens[i].safeApprove(address(_swapRouter), type(uint256).max);

            alreadyApprovedTokens[address(_tokens[i])][address(_nfpm)] = true;
            alreadyApprovedTokens[address(_tokens[i])][address(_swapRouter)] = true;
        }
    }

    function approveToken(IERC20 _token) public onlyOwner {
        _token.safeApprove(address(swapRouter), type(uint256).max);
        _token.safeApprove(address(nonfungiblePositionManager), type(uint256).max);

        alreadyApprovedTokens[address(_token)][address(swapRouter)] = true;
        alreadyApprovedTokens[address(_token)][address(nonfungiblePositionManager)] = true;
    }

    function _createDeposit(address owner, uint256 tokenId) internal {
        (,, address token0, address token1,,,, uint128 liquidity,,,,) = nonfungiblePositionManager.positions(tokenId);

        // set the owner and data for position
        // operator is msg.sender
        deposits[tokenId] = Deposit({owner: owner, liquidity: liquidity, token0: token0, token1: token1});

        emit DepositCreated(msg.sender, tokenId);
    }

    function onERC721Received(address operator, address, uint256 tokenId, bytes calldata) external returns (bytes4) {
        _createDeposit(operator, tokenId);
        return this.onERC721Received.selector;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param _fee Fee of the uniswap pool. For example, 0.01% = 100
    /// @param _tokenOut The receiving token
    /// @param _amountOutMinimum The minimum amount expected to receive
    /// @param _receiveETH Receive ETH or WETH
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    /// @param _proxyFee The fee of the proxy contract
    function swapExactInputSingle(
        uint24 _fee,
        address _tokenOut,
        uint256 _amountOutMinimum,
        uint160 _sqrtPriceLimitX96,
        bool _receiveETH,
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature
    ) public payable returns (uint256) {
        if (_receiveETH) {
            require(_tokenOut == weth, "Token out must be WETH");
        }

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        uint256 amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                fee: _fee,
                tokenIn: _permit.permitted.token,
                tokenOut: _tokenOut,
                deadline: block.timestamp,
                amountIn: _permit.permitted.amount,
                amountOutMinimum: _amountOutMinimum,
                sqrtPriceLimitX96: _sqrtPriceLimitX96,
                recipient: _receiveETH ? address(this) : msg.sender
            })
        );

        if (_receiveETH) {
            IWETH9(payable(weth)).withdraw(amountOut);
            (bool sent,) = payable(msg.sender).call{value: amountOut}("");
            require(sent, "Failed to send Ether");
        }

        return amountOut;
    }


    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @dev One of the tokens is ETH
    /// @param _fee Fee of the uniswap pool. For example, 0.01% = 100
    /// @param _tokenOut The receiving token
    /// @param _amountOutMinimum The minimum amount expected to receive
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    /// @param _proxyFee The fee of the proxy contract
    function swapExactInputSingleETH(
        uint24 _fee,
        address _tokenOut,
        uint256 _amountOutMinimum,
        uint160 _sqrtPriceLimitX96,
        uint256 _proxyFee
    ) public payable returns (uint256) {
        uint256 value = msg.value - _proxyFee;

        return swapRouter.exactInputSingle{value: value}(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(weth),
                tokenOut: _tokenOut,
                fee: _fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: value,
                amountOutMinimum: _amountOutMinimum,
                sqrtPriceLimitX96: _sqrtPriceLimitX96
            })
        );
    }

    /// @notice Swaps as little as possible of one token for `amountOut` of another token
    /// @param _fee Fee of the uniswap pool. For example, 0.01% = 100
    /// @param _tokenOut The receiving token
    /// @param _amountOut The exact amount expected to receive
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    /// @return amountIn The amount of the input token
    function swapExactOutputSingle(
        uint24 _fee,
        address _tokenOut,
        uint256 _amountOut,
        uint160 _sqrtPriceLimitX96,
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature
    ) public payable returns (uint256) {
        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        uint256 amountIn = swapRouter.exactOutputSingle(
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: _permit.permitted.token,
                tokenOut: _tokenOut,
                fee: _fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: _amountOut,
                amountInMaximum: _permit.permitted.amount,
                sqrtPriceLimitX96: _sqrtPriceLimitX96
            })
        );

        if (amountIn < _permit.permitted.amount) {
            IERC20(_permit.permitted.token).safeTransfer(msg.sender, _permit.permitted.amount - amountIn);
        }

        return amountIn;
    }

    /// @notice Calls the mint function defined in periphery, mints the same amount of each token.
    /// For this example we are providing 1000 DAI and 1000 USDC in liquidity
    /// @param _fee Fee of the uniswap pool. For example, 0.01% = 100
    /// @param _tickLower The lower tick in the range
    /// @param _tickUpper The upper tick in the range
    /// @param _amount0Min Minimum amount of the first token to receive
    /// @param _amount1Min Minimum amount of the second token to receive
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    /// @return tokenId The id of the newly minted ERC721
    /// @return liquidity The amount of liquidity for the position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function mintNewPosition(
        uint24 _fee,
        int24 _tickLower,
        int24 _tickUpper,
        uint256 _amount0Min,
        uint256 _amount1Min,
        ISignatureTransfer.PermitBatchTransferFrom calldata _permit,
        bytes calldata _signature
    ) external payable returns (uint256 _tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {
        uint256 tokensLen = _permit.permitted.length;

        ISignatureTransfer.SignatureTransferDetails[] memory details =
            new ISignatureTransfer.SignatureTransferDetails[](tokensLen);

        details[0].to = address(this);
        details[0].requestedAmount = _permit.permitted[0].amount;

        if (tokensLen > 1) {
            details[1].to = address(this);
            details[1].requestedAmount = _permit.permitted[1].amount;
        }

        permit2.permitTransferFrom(_permit, details, msg.sender, _signature);

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: _permit.permitted[0].token,
            token1: tokensLen > 1 ? _permit.permitted[1].token : weth,
            fee: _fee,
            tickLower: _tickLower,
            tickUpper: _tickUpper,
            amount0Desired: _permit.permitted[0].amount,
            amount1Desired: tokensLen > 1 ? _permit.permitted[1].amount : msg.value,
            amount0Min: _amount0Min,
            amount1Min: _amount1Min,
            recipient: msg.sender,
            deadline: block.timestamp
        });

        (_tokenId, liquidity, amount0, amount1) = nonfungiblePositionManager.mint{value: msg.value}(params);

        _createDeposit(msg.sender, _tokenId);

        if (amount0 < _permit.permitted[0].amount) {
            uint256 refund0 = _permit.permitted[0].amount - amount0;

            IERC20(_permit.permitted[0].token).safeTransfer(msg.sender, refund0);
        }

        if (tokensLen > 1 && amount1 < _permit.permitted[1].amount) {
            uint256 refund1 = _permit.permitted[1].amount - amount1;

            IERC20(_permit.permitted[1].token).safeTransfer(msg.sender, refund1);
        }
    }

    /// @notice Collects the fees associated with provided liquidity
    /// @dev The contract must hold the erc721 token before it can collect fees
    /// @param _tokenId The id of the erc721 token
    /// @return amount0 The amount of fees collected in token0
    /// @return amount1 The amount of fees collected in token1
    function collectAllFees(uint256 _tokenId, uint128 _amount0Max, uint128 _amount1Max)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        require(msg.sender == deposits[_tokenId].owner, "Not the owner");

        if (deposits[_tokenId].liquidity == 0) {
            nonfungiblePositionManager.transferFrom(msg.sender, address(this), _tokenId);
        }

        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: _tokenId,
            recipient: msg.sender,
            amount0Max: _amount0Max,
            amount1Max: _amount1Max
        });

        (amount0, amount1) = nonfungiblePositionManager.collect(params);
    }

    /// @notice Increases liquidity in the current range
    /// @dev Pool must be initialized already to add liquidity
    /// @param _tokenId The id of the erc721 token
    /// @param _amountAdd0 The amount to add of token0
    /// @param _amountAdd1 The amount to add of token1
    /// @param _amount0Min Minimum amount of the first token to receive
    /// @param _amount1Min Minimum amount of the second token to receive
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    function increaseLiquidity(
        uint256 _tokenId,
        uint256 _amountAdd0,
        uint256 _amountAdd1,
        uint256 _amount0Min,
        uint256 _amount1Min,
        ISignatureTransfer.PermitBatchTransferFrom calldata _permit,
        bytes calldata _signature
    ) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
        uint256 tokensLen = _permit.permitted.length;

        ISignatureTransfer.SignatureTransferDetails[] memory details =
            new ISignatureTransfer.SignatureTransferDetails[](tokensLen);

        details[0].to = address(this);
        details[0].requestedAmount = _permit.permitted[0].amount;

        if (tokensLen > 1) {
            details[1].to = address(this);
            details[1].requestedAmount = _permit.permitted[1].amount;
        }

        permit2.permitTransferFrom(_permit, details, msg.sender, _signature);

        INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager
            .IncreaseLiquidityParams({
            tokenId: _tokenId,
            amount0Desired: _amountAdd0,
            amount1Desired: _amountAdd1,
            amount0Min: _amount0Min,
            amount1Min: _amount1Min,
            deadline: block.timestamp
        });

        (liquidity, amount0, amount1) = nonfungiblePositionManager.increaseLiquidity{value: msg.value}(params);
    }

    /// @notice A function that decreases the current liquidity by half. An example to show how to call the `decreaseLiquidity` function defined in periphery.
    /// @param _tokenId The id of the erc721 token
    /// @param _liquidity The liquidity amount to decrease.
    /// @param _amount0Min Minimum amount of the first token to receive
    /// @param _amount1Min Minimum amount of the second token to receive
    /// @return amount0 The amount received back in token0
    /// @return amount1 The amount returned back in token1
    function decreaseLiquidity(uint256 _tokenId, uint128 _liquidity, uint256 _amount0Min, uint256 _amount1Min)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        require(msg.sender == deposits[_tokenId].owner, "Not the owner");

        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager
            .DecreaseLiquidityParams({
            tokenId: _tokenId,
            liquidity: _liquidity,
            amount0Min: _amount0Min,
            amount1Min: _amount1Min,
            deadline: block.timestamp
        });

        (amount0, amount1) = nonfungiblePositionManager.decreaseLiquidity(params);

        _sendToOwner(_tokenId, amount0, amount1);
    }

    /// @notice Transfers funds to owner of NFT
    /// @param _tokenId The id of the erc721
    /// @param _amount0 The amount of token0
    /// @param _amount1 The amount of token1
    function _sendToOwner(uint256 _tokenId, uint256 _amount0, uint256 _amount1) internal {
        // get owner of contract
        address owner = deposits[_tokenId].owner;

        address token0 = deposits[_tokenId].token0;
        address token1 = deposits[_tokenId].token1;
        // send collected fees to owner
        IERC20(token0).safeTransfer(owner, _amount0);
        IERC20(token1).safeTransfer(owner, _amount1);
    }

    /// @notice Transfers the NFT to the owner
    /// @param _tokenId The id of the erc721
    function retrieveNFT(uint256 _tokenId) external payable {
        require(msg.sender == deposits[_tokenId].owner, "Not the owner");

        nonfungiblePositionManager.safeTransferFrom(address(this), msg.sender, _tokenId);

        delete deposits[_tokenId];
    }

    /// @notice Executes encoded commands along with provided inputs. Reverts if deadline has expired.
    /// @param _commands A set of concatenated commands, each 1 byte in length
    /// @param _inputs An array of byte strings containing abi encoded inputs for each command
    /// @param _deadline The deadline by which the transaction must be executed
    /// @param _fee Fee of the proxy contract
    function execute(bytes calldata _commands, bytes[] calldata _inputs, uint256 _deadline, uint256 _fee)
        external
        payable
        override
    {
        universalRouter.execute{value: msg.value - _fee}(_commands, _inputs, _deadline);
    }

    /// @notice Executes encoded commands along with provided inputs. Reverts if deadline has expired.
    /// @param _commands A set of concatenated commands, each 1 byte in length
    /// @param _inputs An array of byte strings containing abi encoded inputs for each command
    /// @param _fee Fee of the proxy contract
    function execute(bytes calldata _commands, bytes[] calldata _inputs, uint256 _fee) external payable override {
        universalRouter.execute{value: msg.value - _fee}(_commands, _inputs);
    }
}
