pragma solidity ^0.5.16;

import "../../contracts/PriceOracle/interfaces/WstEthInterface.sol";

contract MockWstEth is WstEthInterface {
    uint256 private _stEthPerToken;

    function setStEthPerToken(uint256 stEthPerToken_) external {
        _stEthPerToken = stEthPerToken_;
    }

    function stEthPerToken() external view returns (uint256) {
        return _stEthPerToken;
    }
}
