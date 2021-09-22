const {
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeCToken,
  makeComptroller,
  makeEvilAccount
} = require('../Utils/Compound');

const collateralFactor = 0.5, underlyingPrice = 1, mintAmount = 2, borrowAmount = 1;

describe('Attack', function () {
  let root, accounts;
  let comptroller;
  let cEth, cEvil;
  let evilAccount;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    cEth = await makeCToken({comptroller, kind: 'cether', supportMarket: true, collateralFactor});
    cEvil = await makeCToken({comptroller, kind: 'cevil', supportMarket: true, collateralFactor, underlyingPrice});
    evilAccount = await makeEvilAccount({crEth: cEth, crEvil: cEvil, borrowAmount: etherMantissa(borrowAmount)});
  });

  it('reentry borrow attack', async () => {
    await send(cEvil.underlying, 'allocateTo', [accounts[0], etherMantissa(100)]);
    await send(cEvil.underlying, 'approve', [cEvil._address, etherMantissa(100)], {from: accounts[0]});
    await send(cEvil, 'mint', [etherMantissa(100)], {from: accounts[0]});

    // Actually, this attack will emit a Failure event with value (3: COMPTROLLER_REJECTION, 6: BORROW_COMPTROLLER_REJECTION, 4: INSUFFICIENT_LIQUIDITY).
    // However, somehow it failed to parse the event.
    await send(evilAccount, 'attack', [], {value: etherMantissa(mintAmount)});

    // The attack should have no effect.
    ({1: liquidity, 2: shortfall} = await call(comptroller, 'getAccountLiquidity', [evilAccount._address]));
    expect(liquidity).toEqualNumber(0);
    expect(shortfall).toEqualNumber(0);
  });
});
