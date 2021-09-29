pragma solidity ^0.5.16;

import "./FaucetToken.sol";
import "../../contracts/Legacy/CEther.sol";
import "../../contracts/CCollateralCapErc20.sol";

/**
 * @title The Compound Evil Test Token
 * @author Compound
 * @notice A simple test token that fails certain operations
 */
contract EvilToken is FaucetToken {
    bool public fail;

    constructor(
        uint256 _initialAmount,
        string memory _tokenName,
        uint8 _decimalUnits,
        string memory _tokenSymbol
    ) public FaucetToken(_initialAmount, _tokenName, _decimalUnits, _tokenSymbol) {
        fail = true;
    }

    function setFail(bool _fail) external {
        fail = _fail;
    }

    function transfer(address dst, uint256 amount) external returns (bool) {
        if (fail) {
            return false;
        }
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(amount);
        balanceOf[dst] = balanceOf[dst].add(amount);
        emit Transfer(msg.sender, dst, amount);
        return true;
    }

    function transferFrom(
        address src,
        address dst,
        uint256 amount
    ) external returns (bool) {
        if (fail) {
            return false;
        }
        balanceOf[src] = balanceOf[src].sub(amount);
        balanceOf[dst] = balanceOf[dst].add(amount);
        allowance[src][msg.sender] = allowance[src][msg.sender].sub(amount);
        emit Transfer(src, dst, amount);
        return true;
    }
}

interface RecipientInterface {
    /**
     * @dev Hook executed upon a transfer to the recipient
     */
    function tokensReceived() external;
}

contract EvilAccount is RecipientInterface {
    address payable private crEth;
    address private crEvilToken;
    uint256 private borrowAmount;

    constructor(
        address payable _crEth,
        address _crEvilToken,
        uint256 _borrowAmount
    ) public {
        crEth = _crEth;
        crEvilToken = _crEvilToken;
        borrowAmount = _borrowAmount;
    }

    function attack() external payable {
        // Mint crEth.
        CEther(crEth).mint.value(msg.value)();
        ComptrollerInterface comptroller = CEther(crEth).comptroller();

        // Enter the market.
        address[] memory markets = new address[](1);
        markets[0] = crEth;
        comptroller.enterMarkets(markets);

        // Borrow EvilTransferToken.
        require(CCollateralCapErc20(crEvilToken).borrow(borrowAmount) == 0, "first borrow failed");
    }

    function tokensReceived() external {
        // Borrow Eth.
        require(CEther(crEth).borrow(borrowAmount) != 0, "reentry borrow succeed");
    }

    function() external payable {}
}

contract EvilTransferToken is FaucetToken {
    constructor(
        uint256 _initialAmount,
        string memory _tokenName,
        uint8 _decimalUnits,
        string memory _tokenSymbol
    ) public FaucetToken(_initialAmount, _tokenName, _decimalUnits, _tokenSymbol) {}

    function transfer(address dst, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(amount);
        balanceOf[dst] = balanceOf[dst].add(amount);
        emit Transfer(msg.sender, dst, amount);

        RecipientInterface(dst).tokensReceived();
        return true;
    }

    function transferFrom(
        address src,
        address dst,
        uint256 amount
    ) external returns (bool) {
        balanceOf[src] = balanceOf[src].sub(amount);
        balanceOf[dst] = balanceOf[dst].add(amount);
        allowance[src][msg.sender] = allowance[src][msg.sender].sub(amount);
        emit Transfer(src, dst, amount);
        return true;
    }
}
