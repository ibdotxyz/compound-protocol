pragma solidity ^0.5.16;

import "../../contracts/PriceOracle/WstEthDelayOracle.sol";

contract MockWstEthDelayOracle is WstEthDelayOracle {
    uint256 private _timestamp;

    constructor(address admin_, address wstEth_) public WstEthDelayOracle(admin_, wstEth_) {}

    function setTimestamp(uint256 timestamp) external {
        _timestamp = timestamp;
    }

    function getTimestamp() public view returns (uint256) {
        return _timestamp;
    }
}
