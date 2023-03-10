pragma solidity ^0.5.16;

interface WstETHInterface {
    function stEthPerToken() external view returns (uint256);

    function tokensPerStEth() external view returns (uint256);
}
