const {
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeCToken,
  makeComptroller,
  makeEvilAccount,
  makeEvilAccount2
} = require('../Utils/Compound');

const collateralFactor = 0.5, underlyingPrice = 1, mintAmount = 2, borrowAmount = 1;

describe('Attack', function () {
  let root, accounts;
  let comptroller;
  let cEth, cWeth, cEvil;
  let evilAccount;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller({closeFactor: 0.5});
    cEth = await makeCToken({comptroller, kind: 'cether', supportMarket: true, collateralFactor});
    cWeth = await makeCToken({comptroller, kind: 'cerc20', supportMarket: true, collateralFactor, underlyingPrice});
    cEvil = await makeCToken({comptroller, kind: 'cevil', supportMarket: true, collateralFactor, underlyingPrice});
    evilAccount = await makeEvilAccount({crEth: cEth, crEvil: cEvil, borrowAmount: etherMantissa(borrowAmount)});

    // Align the block number.
    const blockNumber = await call(cEth, 'blockNumber');
    await send(cWeth, 'harnessSetBlockNumber', [blockNumber]);
    await send(cEvil, 'harnessSetBlockNumber', [blockNumber]);
  });

  it('reentry borrow attack', async () => {
    await send(cEvil.underlying, 'allocateTo', [accounts[0], etherMantissa(100)]);
    await send(cEvil.underlying, 'approve', [cEvil._address, etherMantissa(100)], {from: accounts[0]});
    await send(cEvil, 'mint', [etherMantissa(100)], {from: accounts[0]});

    // Actually, this attack will emit a Failure event with value (3: COMPTROLLER_REJECTION, 6: BORROW_COMPTROLLER_REJECTION, 4: INSUFFICIENT_LIQUIDITY).
    // However, somehow it failed to parse the event.
    await send(cEvil.underlying, 'turnSwitchOn');
    await send(evilAccount, 'attackBorrow', [], {value: etherMantissa(mintAmount)});

    // The attack should have no effect.
    ({1: liquidity, 2: shortfall} = await call(comptroller, 'getAccountLiquidity', [evilAccount._address]));
    expect(liquidity).toEqualNumber(0);
    expect(shortfall).toEqualNumber(0);
  });

  it('reentry liquidate attack', async () => {
    /**
     * In this test, a victim supplied 20 WETH (collateral = 10) and borrowed 5 Evil and 5 WETH, which used all of his collateral.
     * Next, we changed the price of Evil (1 to 1.1) to make the victim liquidatable. If a successful attack happened, an attacker
     * could liquidate 2.5 Evil and 2.5 WETH. It's similiar to bypass the close factor since the victim only have 0.5 shortfall.
     *
     * In our new CCollateralCapErc20CheckRepay, it could prevent such an attack. If a re-entry liquidation attacked happened,
     * it should revert with 'borrower has no shortfall' during the second liquidation.
     *
     * After that, we could use an EOA to liquidate the victim for 2.5 Evil (or 2.5 WETH).
     */
    const victim = accounts[0];
    const liquidator = accounts[1];
    const repayAmount = etherMantissa(2.5);
    const evilAccount2 = await makeEvilAccount2({crWeth: cWeth, crEvil: cEvil, borrower: victim, repayAmount: repayAmount});

    // Supply 20 WETH.
    await send(cWeth.underlying, 'harnessSetBalance', [victim, etherMantissa(20)]);
    await send(cWeth.underlying, 'approve', [cWeth._address, etherMantissa(20)], {from: victim});
    await send(cWeth, 'mint', [etherMantissa(20)], {from: victim});
    await send(comptroller, 'enterMarkets', [[cWeth._address]], {from: victim});

    // Borrow 5 WETH and 5 Evil.
    await send(cWeth, 'borrow', [etherMantissa(5)], {from: victim});
    await send(cEvil.underlying, 'allocateTo', [cEvil._address, etherMantissa(5)]);
    await send(cEvil, 'gulp');
    await send(cEvil, 'borrow', [etherMantissa(5)], {from: victim});

    // Check account liquidity: no more liquidity and no shortfall at this moment.
    ({1: liquidity, 2: shortfall} = await call(comptroller, 'getAccountLiquidity', [victim]));
    expect(liquidity).toEqualNumber(0);
    expect(shortfall).toEqualNumber(0);

    // Change the Evil price to make the victim could be liqudated.
    const newUnderlyingPrice = 1.1;
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [cEvil._address, etherMantissa(newUnderlyingPrice)]);

    // Confirm the victim has shortfall.
    ({1: liquidity, 2: shortfall} = await call(comptroller, 'getAccountLiquidity', [victim]));
    expect(liquidity).toEqualNumber(0);
    expect(shortfall).toEqualNumber(etherMantissa(0.5));

    // Attack the victim through liquidation.
    await send(cWeth.underlying, 'harnessSetBalance', [evilAccount2._address, etherMantissa(10)]);
    await send(cEvil.underlying, 'allocateTo', [evilAccount2._address, etherMantissa(10)]);
    await send(cEvil.underlying, 'turnSwitchOn');
    await expect(send(evilAccount2, 'attackLiquidate')).rejects.toRevert('revert borrower has no shortfall');

    // The re-entry liquidation attack failed. The victim still has shortfall.
    ({1: liquidity, 2: shortfall} = await call(comptroller, 'getAccountLiquidity', [victim]));
    expect(liquidity).toEqualNumber(0);
    expect(shortfall).toEqualNumber(etherMantissa(0.5));

    // We use an EOA to liquidate the victim.
    await send(cEvil.underlying, 'allocateTo', [liquidator, repayAmount]);
    await send(cEvil.underlying, 'approve', [cEvil._address, repayAmount], {from: liquidator});
    await send(cEvil.underlying, 'turnSwitchOff');
    await send(cEvil, 'liquidateBorrow', [victim, repayAmount, cWeth._address], {from: liquidator});

    // The normal liquidation succeeded. The victim should have no shortfall now.
    ({1: liquidity, 2: shortfall} = await call(comptroller, 'getAccountLiquidity', [victim]));
    expect(liquidity).toEqualNumber(etherMantissa(0.875));
    expect(shortfall).toEqualNumber(0);
  });
});
