const {
  address,
  etherMantissa
} = require('./Utils/Ethereum');

const {
  makeComptroller,
  makeToken,
  makeCToken,
  makePriceOracle,
  makeMockAggregator,
  makeMockReference
} = require('./Utils/Compound');

describe('PriceOracleProxyIB', () => {
  let root, accounts;
  let oracle, backingOracle, cUsdc, cOther;
  let reference;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    const comptroller = await makeComptroller();
    cUsdc = await makeCToken({comptroller: comptroller, supportMarket: true, underlyingOpts: {decimals: 6}});
    cOther = await makeCToken({comptroller: comptroller, supportMarket: true});
    reference = await makeMockReference();

    backingOracle = await makePriceOracle();
    oracle = await deploy('PriceOracleProxyFTM', [root, backingOracle._address, reference._address]);
  });

  describe("constructor", () => {
    it("sets address of admin", async () => {
      let configuredGuardian = await call(oracle, "admin");
      expect(configuredGuardian).toEqual(root);
    });

    it("sets address of reference", async () => {
      let configuredRef = await call(oracle, "ref");
      expect(configuredRef).toEqual(reference._address);
    });

    it("sets address of v1 price oracle", async () => {
      let configuredV1 = await call(oracle, "v1PriceOracle");
      expect(configuredV1).toEqual(backingOracle._address);
    });
  });

  describe("getUnderlyingPrice", () => {
    let setChainLinkPrice = async (token, price) => {
      const mockAggregator = await makeMockAggregator({answer: price});
      await send(
        oracle,
        "_setAggregators",
        [[token], [mockAggregator._address]]);
    }

    let setBandPrice = async (token, price) => {
      const symbol = await call(token, "symbol");
      await send(reference, "setReferenceData", [symbol, price, 0, 0]);
      await send(oracle, "_setReferences", [[token._address], [symbol]]);
    };

    let setAndVerifyBackingPrice = async (cToken, price) => {
      await send(
        backingOracle,
        "setUnderlyingPrice",
        [cToken._address, etherMantissa(price)]);

      let backingOraclePrice = await call(
        backingOracle,
        "assetPrices",
        [cToken.underlying._address]);

      expect(Number(backingOraclePrice)).toEqual(price * 1e18);
    };

    let readAndVerifyProxyPrice = async (token, price) =>{
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [token._address]);
      expect(Number(proxyPrice)).toEqual(price * 1e18);
    };

    it("gets price from ChainLink", async () => {
      const price = etherMantissa(1);

      await setChainLinkPrice(cOther.underlying._address, price);
      const proxyPrice = await call(oracle, "getUnderlyingPrice", [cOther._address]);
      expect(proxyPrice).toEqual(price.toFixed());
    });

    it("gets price from Band protocol", async () => {
      const price = etherMantissa(1);

      await setBandPrice(cOther.underlying, price);
      const proxyPrice = await call(oracle, "getUnderlyingPrice", [cOther._address]);
      expect(proxyPrice).toEqual(price.toFixed());
    });

    it("fallbacks to price oracle v1", async () => {
      await setAndVerifyBackingPrice(cOther, 11);
      await readAndVerifyProxyPrice(cOther, 11);

      await setAndVerifyBackingPrice(cOther, 37);
      await readAndVerifyProxyPrice(cOther, 37);
    });

    it("returns 0 for token without a price", async () => {
      let unlistedToken = await makeCToken({comptroller: cUsdc.comptroller});

      await readAndVerifyProxyPrice(unlistedToken, 0);
    });
  });

  describe("_setAdmin", () => {
    it("set admin successfully", async () => {
      expect(await send(oracle, "_setAdmin", [accounts[0]])).toSucceed();
    });

    it("fails to set admin for non-admin", async () => {
      await expect(send(oracle, "_setAdmin", [accounts[0]], {from: accounts[0]})).rejects.toRevert("revert only the admin may set new admin");
    });
  });

  describe("_setGuardian", () => {
    it("set guardian successfully", async () => {
      expect(await send(oracle, "_setGuardian", [accounts[0]])).toSucceed();
    });

    it("fails to set guardian for non-admin", async () => {
      await expect(send(oracle, "_setGuardian", [accounts[0]], {from: accounts[0]})).rejects.toRevert("revert only the admin may set new guardian");
    });
  });

  describe("_setAggregators", () => {
    const price = etherMantissa(1);

    let token, mockAggregator;

    beforeEach(async () => {
      token = await makeToken();
      mockAggregator = await makeMockAggregator({answer: price});
    });

    it("set aggregators successfully", async () => {
      expect(await send(oracle, "_setAggregators", [[token._address], [mockAggregator._address]])).toSucceed();

      const aggregator = await call(oracle, "aggregators", [token._address]);
      expect(aggregator.aggregator).toEqual(mockAggregator._address);
      expect(aggregator.isUsed).toEqual(true);
    });

    it("fails to set aggregators for non-admin", async () => {
      await expect(send(oracle, "_setAggregators", [[token._address], [mockAggregator._address]], {from: accounts[0]})).rejects.toRevert("revert only the admin or guardian may set the aggregators");
      expect(await send(oracle, "_setGuardian", [accounts[0]])).toSucceed();
      await expect(send(oracle, "_setAggregators", [[token._address], [mockAggregator._address]], {from: accounts[0]})).rejects.toRevert("revert guardian may only clear the aggregator");
    });

    it("fails to set aggregators for mismatched data", async () => {
      await expect(send(oracle, "_setAggregators", [[token._address], []])).rejects.toRevert("revert mismatched data");
      await expect(send(oracle, "_setAggregators", [[], [mockAggregator._address]])).rejects.toRevert("revert mismatched data");
    });

    it("clear aggregators successfully", async () => {
      expect(await send(oracle, "_setGuardian", [accounts[0]])).toSucceed();
      expect(await send(oracle, "_setAggregators", [[token._address], [address(0)]], {from: accounts[0]})).toSucceed();

      const aggregator = await call(oracle, "aggregators", [token._address]);
      expect(aggregator.aggregator).toEqual(address(0));
      expect(aggregator.isUsed).toEqual(false);
    });
  });

  describe("_setReferences", () => {
    let token;
    let symbol;

    let setBandPrice = async (token, symbol, price) => {
      await send(reference, "setReferenceData", [symbol, price, 0, 0]);
      await send(oracle, "_setReferences", [[token._address], [symbol]]);
    };

    beforeEach(async () => {
      token = await makeToken();
      symbol = await call(token, "symbol");
    });

    it("set references successfully", async () => {
      const price = etherMantissa(1);
      await setBandPrice(token, symbol, price);
      expect(await send(oracle, "_setReferences", [[token._address], [symbol]])).toSucceed();

      const reference = await call(oracle, "references", [token._address]);
      expect(reference.symbol).toEqual(symbol);
      expect(reference.isUsed).toEqual(true);
    });

    it("fails to set references for non-admin", async () => {
      await expect(send(oracle, "_setReferences", [[token._address], [symbol]], {from: accounts[0]})).rejects.toRevert("revert only the admin or guardian may set the references");
      expect(await send(oracle, "_setGuardian", [accounts[0]])).toSucceed();
      await expect(send(oracle, "_setReferences", [[token._address], [symbol]], {from: accounts[0]})).rejects.toRevert("revert guardian may only clear the reference");
    });

    it("fails to set references for mismatched data", async () => {
      await expect(send(oracle, "_setReferences", [[token._address], []])).rejects.toRevert("revert mismatched data");
      await expect(send(oracle, "_setReferences", [[], [symbol]])).rejects.toRevert("revert mismatched data");
    });

    it("fails to set references for invalid price", async () => {
      await expect(send(oracle, "_setReferences", [[token._address], [symbol]])).rejects.toRevert("revert invalid price");
    });

    it("clear references successfully", async () => {
      expect(await send(oracle, "_setGuardian", [accounts[0]])).toSucceed();
      expect(await send(oracle, "_setReferences", [[token._address], ['']], {from: accounts[0]})).toSucceed();

      const reference = await call(oracle, "references", [token._address]);
      expect(reference.symbol).toEqual('');
      expect(reference.isUsed).toEqual(false);
    });
  });
});
