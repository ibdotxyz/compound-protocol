[![CircleCI](https://circleci.com/gh/ibdotxyz/compound-protocol/tree/eth.svg?style=svg)](https://circleci.com/gh/ibdotxyz/compound-protocol/tree/eth)

Iron Bank
=================
Iron Bank is a blockchain agnostic, decentralized peer to peer lending platform based on a fork of [Compound Finance](https://compound.finance).

Iron Bank bridges liquidity across underserved assets by providing algorithmic money markets to these underserved assets. Users can supply any supported assets and use these supplied assets as collateral to borrow any other supported assets. Iron Bank has launched on Ethereum, Fantom and Avalance.

Before getting started with this repo, please read the [Compound protocol](https://github.com/compound-finance/compound-protocol) repo,

Installation
------------

    git clone https://github.com/ib/compound-protocol
    cd compound-protocol
    yarn install --lock-file # or `npm install`

Building
------
    yarn compile

Testing
-------
Jest contract tests are defined under the [tests directory](https://github.com/ib/compound-protocol/tree/master/tests). To run the tests run:

    yarn test

Branch
------
[eth](https://github.com/ib/compound-protocol/tree/eth) - deployed on ethereum mainnet

[ftm](https://github.com/ib/compound-protocol/tree/ftm) - deployed on fantom opera

[avax](https://github.com/ib/compound-protocol/tree/avax) - deployed on avalanche

Change Logs
-----------

- Add borrow cap feature, this feature is cherry picked from Compound Finance https://github.com/compound-finance/compound-protocol/pull/65
  * Add a borrow cap check in Comptroller's borrowAllowed hook, disallow further borrowing if an market's totalBorrows reaches its borrow cap

- Add supply cap feature, implemented in Comptroller.sol, CCapableErc20.sol
  * Add a supply cap check in Comptroller's mintAllowed hook, disallow further minting (supplying) if an market's cash + totalBorrows reaches its supply cap
  * CCapableErc20 tracks cash by itself instead of using balanceOf of underlying token. This avoids direct transfering to cToken to manipulate cash.

- Add collateral cap feature, implemented in Comptroller.sol, CCollateralCapErc20.sol
  * Add a collateral cap to determine the maximum balance to be considered as collateral. If the cap is reached, users could still supply the asset but it can't be used as collateral.
  * The maximum borrow power of this kind of asset is roughly collateralCap * collateralFactor.

- Add CWrappedNative to replace old CEther
  * CWrappedNative could support both the native token and the wrapped native token.
  * Users could choose the native token or the wrapped native token when supplying / borrowing / redeeming / repaying.

- Support protocol to protocol borrowing without collateral, this gives whitelisted protocol borrows up to credit limit without collateral.
  * Add credit limit in Comptroller.sol
  * When setup a credit limit, it also needs to specify the borrow markets.

- Support flashloan feature to offer a wide range of use cases, including democratized liquidations, arbitrage, collateral swapping and interest rate swapping.
  * Iron Bank flashloan complies EIP-3156 standard.
  * Not every market supports flashloan.
