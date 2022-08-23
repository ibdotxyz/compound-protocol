const {
  address,
  etherMantissa,
  both,
  UInt256Max
} = require('../Utils/Ethereum');

const {
  makeComptroller,
  makePriceOracle,
  makeCToken,
  makeToken,
  makeLiquidityMining
} = require('../Utils/Compound');

describe('Comptroller', () => {
  let root, accounts;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('constructor', () => {
    it("on success it sets admin to creator and pendingAdmin is unset", async () => {
      const comptroller = await makeComptroller();
      expect(await call(comptroller, 'admin')).toEqual(root);
      expect(await call(comptroller, 'pendingAdmin')).toEqualNumber(0);
    });

    it("on success it sets closeFactor and maxAssets as specified", async () => {
      const comptroller = await makeComptroller();
      expect(await call(comptroller, 'closeFactorMantissa')).toEqualNumber(0.051e18);
    });
  });

  describe('_setLiquidationIncentive', () => {
    const initialIncentive = etherMantissa(1.0);
    const validIncentive = etherMantissa(1.1);

    let comptroller;
    beforeEach(async () => {
      comptroller = await makeComptroller();
    });

    it("fails if called by non-admin", async () => {
      const {reply, receipt} = await both(comptroller, '_setLiquidationIncentive', [initialIncentive], {from: accounts[0]});
      expect(reply).toHaveTrollError('UNAUTHORIZED');
      expect(receipt).toHaveTrollFailure('UNAUTHORIZED', 'SET_LIQUIDATION_INCENTIVE_OWNER_CHECK');
      expect(await call(comptroller, 'liquidationIncentiveMantissa')).toEqualNumber(initialIncentive);
    });

    it("accepts a valid incentive and emits a NewLiquidationIncentive event", async () => {
      const {reply, receipt} = await both(comptroller, '_setLiquidationIncentive', [validIncentive]);
      expect(reply).toHaveTrollError('NO_ERROR');
      expect(receipt).toHaveLog('NewLiquidationIncentive', {
        oldLiquidationIncentiveMantissa: initialIncentive.toString(),
        newLiquidationIncentiveMantissa: validIncentive.toString()
      });
      expect(await call(comptroller, 'liquidationIncentiveMantissa')).toEqualNumber(validIncentive);
    });
  });

  describe('_setPriceOracle', () => {
    let comptroller, oldOracle, newOracle;
    beforeEach(async () => {
      comptroller = await makeComptroller();
      oldOracle = comptroller.priceOracle;
      newOracle = await makePriceOracle();
    });

    it("fails if called by non-admin", async () => {
      expect(
        await send(comptroller, '_setPriceOracle', [newOracle._address], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SET_PRICE_ORACLE_OWNER_CHECK');
      expect(await comptroller.methods.oracle().call()).toEqual(oldOracle._address);
    });

    it.skip("reverts if passed a contract that doesn't implement isPriceOracle", async () => {
      await expect(send(comptroller, '_setPriceOracle', [comptroller._address])).rejects.toRevert();
      expect(await call(comptroller, 'oracle')).toEqual(oldOracle._address);
    });

    it.skip("reverts if passed a contract that implements isPriceOracle as false", async () => {
      await send(newOracle, 'setIsPriceOracle', [false]); // Note: not yet implemented
      await expect(send(notOracle, '_setPriceOracle', [comptroller._address])).rejects.toRevert("revert oracle method isPriceOracle returned false");
      expect(await call(comptroller, 'oracle')).toEqual(oldOracle._address);
    });

    it("accepts a valid price oracle and emits a NewPriceOracle event", async () => {
      const result = await send(comptroller, '_setPriceOracle', [newOracle._address]);
      expect(result).toSucceed();
      expect(result).toHaveLog('NewPriceOracle', {
        oldPriceOracle: oldOracle._address,
        newPriceOracle: newOracle._address
      });
      expect(await call(comptroller, 'oracle')).toEqual(newOracle._address);
    });
  });

  describe('_setLiquidityMining', () => {
    let comptroller;
    let liquidityMining;

    beforeEach(async () => {
      comptroller = await makeComptroller();
      liquidityMining = await makeLiquidityMining({comptroller: comptroller});
    });

    it("fails if called by non-admin", async () => {
      await expect(send(comptroller, '_setLiquidityMining', [liquidityMining._address], {from: accounts[0]})).rejects.toRevert("revert admin only");
    });

    it("fails for mismatch comptroller", async () => {
      liquidityMining = await makeLiquidityMining();
      await expect(send(comptroller, '_setLiquidityMining', [liquidityMining._address])).rejects.toRevert("revert mismatch comptroller");
    });

    it("succeeds and emits a NewLiquidityMining event", async () => {
      const result = await send(comptroller, '_setLiquidityMining', [liquidityMining._address]);
      expect(result).toSucceed();
      expect(result).toHaveLog('NewLiquidityMining', {
        oldLiquidityMining: address(0),
        newLiquidityMining: liquidityMining._address
      });
      expect(await call(comptroller, 'liquidityMining')).toEqual(liquidityMining._address);
    });
  });

  describe('_setCreditLimitManager', () => {
    let comptroller;

    beforeEach(async () => {
      comptroller = await makeComptroller();
    });

    it('fails if called by non-admin', async () => {
      await expect(send(comptroller, '_setCreditLimitManager', [accounts[0]], {from: accounts[0]})).rejects.toRevert("revert admin only");
    });

    it("succeeds and emits a NewCreditLimitManager event", async () => {
      const result = await send(comptroller, '_setCreditLimitManager', [accounts[0]]);
      expect(result).toSucceed();
      expect(result).toHaveLog('NewCreditLimitManager', {
        oldCreditLimitManager: address(0),
        newCreditLimitManager: accounts[0]
      });
      expect(await call(comptroller, 'creditLimitManager')).toEqual(accounts[0]);
    });
  });

  describe('_setCloseFactor', () => {
    it("fails if not called by admin", async () => {
      const cToken = await makeCToken();
      expect(
        await send(cToken.comptroller, '_setCloseFactor', [1], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SET_CLOSE_FACTOR_OWNER_CHECK');
    });
  });

  describe('_setCollateralFactor', () => {
    const half = etherMantissa(0.5);
    const one = etherMantissa(1);

    it("fails if not called by admin", async () => {
      const cToken = await makeCToken();
      expect(
        await send(cToken.comptroller, '_setCollateralFactor', [cToken._address, half], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SET_COLLATERAL_FACTOR_OWNER_CHECK');
    });

    it("fails if asset is not listed", async () => {
      const cToken = await makeCToken();
      expect(
        await send(cToken.comptroller, '_setCollateralFactor', [cToken._address, half])
      ).toHaveTrollFailure('MARKET_NOT_LISTED', 'SET_COLLATERAL_FACTOR_NO_EXISTS');
    });

    it("fails if factor is too high", async () => {
      const cToken = await makeCToken({supportMarket: true});
      expect(
        await send(cToken.comptroller, '_setCollateralFactor', [cToken._address, one])
      ).toHaveTrollFailure('INVALID_COLLATERAL_FACTOR', 'SET_COLLATERAL_FACTOR_VALIDATION');
    });

    it("fails if factor is set without an underlying price", async () => {
      const cToken = await makeCToken({supportMarket: true});
      expect(
        await send(cToken.comptroller, '_setCollateralFactor', [cToken._address, half])
      ).toHaveTrollFailure('PRICE_ERROR', 'SET_COLLATERAL_FACTOR_WITHOUT_PRICE');
    });

    it("succeeds and sets market", async () => {
      const cToken = await makeCToken({supportMarket: true, underlyingPrice: 1});
      const result = await send(cToken.comptroller, '_setCollateralFactor', [cToken._address, half]);
      expect(result).toHaveLog('NewCollateralFactor', {
        cToken: cToken._address,
        oldCollateralFactorMantissa: '0',
        newCollateralFactorMantissa: half.toString()
      });
    });
  });

  describe('_supportMarket', () => {
    const version = 0;

    it("fails if not called by admin", async () => {
      const cToken = await makeCToken(root);
      await expect(send(cToken.comptroller, '_supportMarket', [cToken._address, version], {from: accounts[0]})).rejects.toRevert('revert admin only');
    });

    it("fails if asset is not a CToken", async () => {
      const comptroller = await makeComptroller()
      const asset = await makeToken(root);
      await expect(send(comptroller, '_supportMarket', [asset._address, version])).rejects.toRevert();
    });

    it("succeeds and sets market", async () => {
      const cToken = await makeCToken();
      const result = await send(cToken.comptroller, '_supportMarket', [cToken._address, version]);
      expect(result).toHaveLog('MarketListed', {cToken: cToken._address});
    });

    it("cannot list a market a second time", async () => {
      const cToken = await makeCToken();
      const result1 = await send(cToken.comptroller, '_supportMarket', [cToken._address, version]);
      expect(result1).toHaveLog('MarketListed', {cToken: cToken._address});
      await expect(send(cToken.comptroller, '_supportMarket', [cToken._address, version])).rejects.toRevert('revert market already listed or delisted');
    });

    it("cannot list a soft delisted market", async () => {
      const cToken = await makeCToken();
      const result1 = await send(cToken.comptroller, '_supportMarket', [cToken._address, version]);
      expect(result1).toHaveLog('MarketListed', {cToken: cToken._address});
      await send(cToken.comptroller, '_setMintPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_setBorrowPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_setFlashloanPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_delistMarket', [cToken._address, false]);
      await expect(send(cToken.comptroller, '_supportMarket', [cToken._address, version])).rejects.toRevert('revert market already listed or delisted');
    });

    it("can list two different markets", async () => {
      const cToken1 = await makeCToken();
      const cToken2 = await makeCToken({comptroller: cToken1.comptroller});
      const result1 = await send(cToken1.comptroller, '_supportMarket', [cToken1._address, version]);
      const result2 = await send(cToken1.comptroller, '_supportMarket', [cToken2._address, version]);
      expect(result1).toHaveLog('MarketListed', {cToken: cToken1._address});
      expect(result2).toHaveLog('MarketListed', {cToken: cToken2._address});
    });
  });

  describe('_setCreditLimit', () => {
    const creditLimit = etherMantissa(500);
    const creditLimit2 = etherMantissa(600);

    it("fails if not called by admin", async () => {
      const cToken = await makeCToken({supportMarket: true});
      await expect(send(cToken.comptroller, '_setCreditLimit', [accounts[0], cToken._address, creditLimit], {from: accounts[1]})).rejects.toRevert("revert admin or credit limit manager only");
    });

    it("fails if called by guardian", async () => {
      const cToken = await makeCToken({supportMarket: true});
      await send(cToken.comptroller, '_setGuardian', [accounts[0]]);

      await expect(send(cToken.comptroller, '_setCreditLimit', [accounts[0], cToken._address, creditLimit], {from: accounts[0]})).rejects.toRevert("revert admin or credit limit manager only");
    });

    it("fails for invalid market", async () => {
      const cToken = await makeCToken();
      await expect(send(cToken.comptroller, '_setCreditLimit', [accounts[0], cToken._address, creditLimit])).rejects.toRevert("revert market not listed");
    });

    it("succeeds and sets credit limit", async () => {
      const cToken = await makeCToken({supportMarket: true});
      const result1 = await send(cToken.comptroller, '_setCreditLimit', [accounts[0], cToken._address, creditLimit]);
      expect(result1).toHaveLog('CreditLimitChanged', {protocol: accounts[0], market: cToken._address, creditLimit: creditLimit.toString()});

      const _creditLimit = await call(cToken.comptroller, 'creditLimits', [accounts[0], cToken._address]);
      expect(_creditLimit).toEqual(creditLimit.toString());

      // Credit limit manager increases the limit.
      await send(cToken.comptroller, '_setCreditLimitManager', [accounts[0]]);
      const result2 = await send(cToken.comptroller, '_setCreditLimit', [accounts[0], cToken._address, creditLimit2], {from: accounts[0]});
      expect(result2).toHaveLog('CreditLimitChanged', {protocol: accounts[0], market: cToken._address, creditLimit: creditLimit2.toString()});

      // Credit limit manager clears the limit.
      const result3 = await send(cToken.comptroller, '_setCreditLimit', [accounts[0], cToken._address, 0], {from: accounts[0]});
      expect(result3).toHaveLog('CreditLimitChanged', {protocol: accounts[0], market: cToken._address, creditLimit: 0});

      const isCreditAccount = await call(cToken.comptroller, 'isCreditAccount', [accounts[0], cToken._address]);
      expect(isCreditAccount).toBeFalsy();
    });
  });

  describe('_pauseCreditLimit', () => {
    const creditLimit = etherMantissa(500);

    it("fails if not called by guardian", async () => {
      const cToken = await makeCToken({supportMarket: true});
      await send(cToken.comptroller, '_setGuardian', [accounts[0]]);

      await expect(send(cToken.comptroller, '_pauseCreditLimit', [accounts[0], cToken._address], {from: accounts[1]})).rejects.toRevert("revert guardian only");
    });

    it("fails for invalid market", async () => {
      const cToken = await makeCToken();
      await send(cToken.comptroller, '_setGuardian', [accounts[0]]);

      await expect(send(cToken.comptroller, '_pauseCreditLimit', [accounts[0], cToken._address], {from: accounts[0]})).rejects.toRevert("revert market not listed");
    });

    it("succeeds and pauses credit limit", async () => {
      const cToken = await makeCToken({supportMarket: true});
      await send(cToken.comptroller, '_setGuardian', [accounts[0]]);

      const result1 = await send(cToken.comptroller, '_setCreditLimit', [accounts[0], cToken._address, creditLimit]);
      expect(result1).toHaveLog('CreditLimitChanged', {protocol: accounts[0], market: cToken._address, creditLimit: creditLimit.toString()});

      const _creditLimit = await call(cToken.comptroller, 'creditLimits', [accounts[0], cToken._address]);
      expect(_creditLimit).toEqual(creditLimit.toString());

      // Guardian pauses the limit.
      const result3 = await send(cToken.comptroller, '_pauseCreditLimit', [accounts[0], cToken._address], {from: accounts[0]});
      expect(result3).toHaveLog('CreditLimitChanged', {protocol: accounts[0], market: cToken._address, creditLimit: 1}); // 1 Wei

      const isCreditAccount = await call(cToken.comptroller, 'isCreditAccount', [accounts[0], cToken._address]);
      expect(isCreditAccount).toBeTruthy(); // still a credit account
    });
  });

  describe('_delistMarket', () => {
    const version = 0;
    const cf = etherMantissa(0.5);

    it("fails if not called by admin", async () => {
      const cToken = await makeCToken(root);
      await expect(send(cToken.comptroller, '_delistMarket', [cToken._address, true], {from: accounts[0]})).rejects.toRevert('revert admin only');
    });

    it("fails if market has collateral", async () => {
      const cToken = await makeCToken({supportMarket: true, underlyingPrice: 1});
      expect(await send(cToken.comptroller, '_setCollateralFactor', [cToken._address, cf])).toSucceed();
      await expect(send(cToken.comptroller, '_delistMarket', [cToken._address, true])).rejects.toRevert('revert market has collateral');
    });

    it("fails if market not paused", async () => {
      const cToken = await makeCToken();
      expect(await send(cToken.comptroller, '_supportMarket', [cToken._address, version])).toSucceed();
      await expect(send(cToken.comptroller, '_delistMarket', [cToken._address, true])).rejects.toRevert('revert market not paused');
    });

    it("succeeds and soft delists market", async () => {
      const cToken = await makeCToken();
      expect(await send(cToken.comptroller, '_supportMarket', [cToken._address, version])).toSucceed();
      await send(cToken.comptroller, '_setMintPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_setBorrowPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_setFlashloanPaused', [cToken._address, true]);
      const result = await send(cToken.comptroller, '_delistMarket', [cToken._address, false]);
      expect(result).toHaveLog('MarketDelisted', {cToken: cToken._address, force: false});
    });

    it("succeeds and hard delists market", async () => {
      const cToken = await makeCToken();
      expect(await send(cToken.comptroller, '_supportMarket', [cToken._address, version])).toSucceed();
      await send(cToken.comptroller, '_setMintPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_setBorrowPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_setFlashloanPaused', [cToken._address, true]);
      const result = await send(cToken.comptroller, '_delistMarket', [cToken._address, true]);
      expect(result).toHaveLog('MarketDelisted', {cToken: cToken._address, force: true});
    });

    it("succeeds and soft delists and then hard delists market", async () => {
      const cToken = await makeCToken();
      expect(await send(cToken.comptroller, '_supportMarket', [cToken._address, version])).toSucceed();
      await send(cToken.comptroller, '_setMintPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_setBorrowPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_setFlashloanPaused', [cToken._address, true]);
      await send(cToken.comptroller, '_delistMarket', [cToken._address, false]);
      await send(cToken.comptroller, '_delistMarket', [cToken._address, true]);
    });

    it("can delist two different markets", async () => {
      const cToken1 = await makeCToken();
      const cToken2 = await makeCToken({comptroller: cToken1.comptroller});
      expect(await send(cToken1.comptroller, '_supportMarket', [cToken1._address, version])).toSucceed();
      expect(await send(cToken2.comptroller, '_supportMarket', [cToken2._address, version])).toSucceed();
      await send(cToken1.comptroller, '_setMintPaused', [cToken1._address, true]);
      await send(cToken1.comptroller, '_setBorrowPaused', [cToken1._address, true]);
      await send(cToken1.comptroller, '_setFlashloanPaused', [cToken1._address, true]);
      await send(cToken2.comptroller, '_setMintPaused', [cToken2._address, true]);
      await send(cToken2.comptroller, '_setBorrowPaused', [cToken2._address, true]);
      await send(cToken2.comptroller, '_setFlashloanPaused', [cToken2._address, true]);
      const result1 = await send(cToken1.comptroller, '_delistMarket', [cToken1._address, false]);
      const result2 = await send(cToken2.comptroller, '_delistMarket', [cToken2._address, true]);
      expect(result1).toHaveLog('MarketDelisted', {cToken: cToken1._address, force: false});
      expect(result2).toHaveLog('MarketDelisted', {cToken: cToken2._address, force: true});
    });
  });

  describe('redeemVerify', () => {
    it('should allow you to redeem 0 underlying for 0 tokens', async () => {
      const comptroller = await makeComptroller();
      const cToken = await makeCToken({comptroller: comptroller});
      await call(comptroller, 'redeemVerify', [cToken._address, accounts[0], 0, 0]);
    });

    it('should allow you to redeem 5 underlyig for 5 tokens', async () => {
      const comptroller = await makeComptroller();
      const cToken = await makeCToken({comptroller: comptroller});
      await call(comptroller, 'redeemVerify', [cToken._address, accounts[0], 5, 5]);
    });

    it('should not allow you to redeem 5 underlying for 0 tokens', async () => {
      const comptroller = await makeComptroller();
      const cToken = await makeCToken({comptroller: comptroller});
      await expect(call(comptroller, 'redeemVerify', [cToken._address, accounts[0], 5, 0])).rejects.toRevert("revert redeemTokens zero");
    });
  });
});
