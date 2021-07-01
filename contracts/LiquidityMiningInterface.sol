pragma solidity ^0.5.16;

contract LiquidityMiningInterface {
    function updateSupplyIndex(address cToken, address[] calldata accounts) external;
    function updateBorrowIndex(address cToken, address[] calldata accounts) external;
}
