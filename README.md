[![CircleCI](https://circleci.com/gh/CreamFi/compound-protocol.svg?style=svg)](https://circleci.com/gh/CreamFi/compound-protocol)

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
