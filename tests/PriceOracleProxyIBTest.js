const {
  address,
  etherMantissa
} = require('./Utils/Ethereum');

const {
  makeComptroller,
  makeToken,
  makeCToken,
  makePriceOracle,
  makeMockRegistry,
  makeMockReference,
} = require('./Utils/Compound');

describe('PriceOracleProxyIB', () => {
  const usdAddress = '0x0000000000000000000000000000000000000348';
  const ethAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

  let root, accounts;
  let oracle, backingOracle, cUsdc, cOther;
  let registry, reference;

  let setBandPrice = async (token, price) => {
    const symbol = await call(token, "symbol");
    await send(reference, "setReferenceData", [symbol, price, 0, 0]);
  };

  let setChainLinkPrice = async (base, quote, price) => {
    await send(registry, "setAnswer", [base, quote, price]);
  }

  let setV1Price = async (cToken, price) => {
    await send(backingOracle, "setUnderlyingPrice", [cToken._address, price]);
  }

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    const comptroller = await makeComptroller();
    cUsdc = await makeCToken({comptroller: comptroller, supportMarket: true, underlyingOpts: {decimals: 6}});
    cOther = await makeCToken({comptroller: comptroller, supportMarket: true});
    registry = await makeMockRegistry();
    reference = await makeMockReference();
    backingOracle = await makePriceOracle();

    oracle = await deploy('PriceOracleProxyIB', [root, backingOracle._address, registry._address, reference._address]);
  });

  describe("constructor", () => {
    it("sets address of admin", async () => {
      let configuredGuardian = await call(oracle, "admin");
      expect(configuredGuardian).toEqual(root);
    });

    it("sets address of backingOracle", async () => {
      let v1PriceOracle = await call(oracle, "v1PriceOracle");
      expect(v1PriceOracle).toEqual(backingOracle._address);
    });

    it("sets address of registry", async () => {
      let reg = await call(oracle, "reg");
      expect(reg).toEqual(registry._address);
    });

    it("sets address of reference", async () => {
      let ref = await call(oracle, "ref");
      expect(ref).toEqual(reference._address);
    });
  });

  describe("getUnderlyingPrice", () => {
    it("gets price from chainlink", async () => {
      const price = '100000000'; // 1e8

      await setChainLinkPrice(cOther.underlying._address, usdAddress, price);
      await send(oracle, "_setAggregators", [[cOther.underlying._address], [cOther.underlying._address], [usdAddress]]);
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [cOther._address]);
      expect(proxyPrice).toEqual(etherMantissa(1).toFixed());
    });

    it("gets price from chainlink (ETH based)", async () => {
      const price = '100000000'; // 1e8
      const ethPrice = '300000000000'; // 3000 * 1e8

      await setChainLinkPrice(cOther.underlying._address, ethAddress, price);
      await setChainLinkPrice(ethAddress, usdAddress, ethPrice);
      await send(oracle, "_setAggregators", [[cOther.underlying._address], [cOther.underlying._address], [ethAddress]]);
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [cOther._address]);
      expect(proxyPrice).toEqual(etherMantissa(3000).toFixed());
    });

    it("gets price from band", async () => {
      const price = etherMantissa(1);

      await setBandPrice(cOther.underlying, price);
      const symbol = await call(cOther.underlying, "symbol");
      await send(oracle, "_setReferences", [[cOther.underlying._address], [symbol]]);
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [cOther._address]);
      expect(proxyPrice).toEqual(price.toFixed());
    });

    it("gets price from v1 for deprecated market", async () => {
      const price = etherMantissa(1);

      await send(oracle, "_updateDeprecatedMarkets", [[cOther.underlying._address], [true]]);
      await setV1Price(cOther, price);
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [cOther._address]);
      expect(proxyPrice).toEqual(price.toFixed());
    });

    it("reverts for token without a price", async () => {
      let unlistedToken = await makeCToken({comptroller: cUsdc.comptroller});

      await expect(call(oracle, "getUnderlyingPrice", [unlistedToken._address])).rejects.toRevert("revert no price");
    });
  });

  describe("_setAdmin", () => {
    it("set admin successfully", async () => {
      expect(await send(oracle, "_setAdmin", [accounts[0]])).toSucceed();
    });

    it("fails to set admin for non-admin", async () => {
      await expect(send(oracle, "_setAdmin", [accounts[0]], {from: accounts[0]})).rejects.toRevert("revert only the admin may set new admin");
    });

    it("fails to set admin invalid admin", async () => {
      await expect(send(oracle, "_setAdmin", [address(0)])).rejects.toRevert("revert invalid admin");
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
    const ethAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const btcAddress = '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB';
    const usdAddress = '0x0000000000000000000000000000000000000348';
    const wbtcAddress = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';

    let token;

    beforeEach(async () => {
      token = await makeToken();
    });

    it("set aggregators successfully", async () => {
      const price = '100000000'; // 1e8

      // token - ETH
      await setChainLinkPrice(token._address, ethAddress, price);
      expect(await send(oracle, "_setAggregators", [[token._address], [token._address], [ethAddress]])).toSucceed();

      let aggregator = await call(oracle, "aggregators", [token._address]);
      expect(aggregator.base).toEqual(token._address);
      expect(aggregator.quote).toEqual(ethAddress);
      expect(aggregator.isUsed).toEqual(true);

      // token - USD
      await setChainLinkPrice(token._address, usdAddress, price);
      expect(await send(oracle, "_setAggregators", [[token._address], [token._address], [usdAddress]])).toSucceed();

      aggregator = await call(oracle, "aggregators", [token._address]);
      expect(aggregator.base).toEqual(token._address);
      expect(aggregator.quote).toEqual(usdAddress);
      expect(aggregator.isUsed).toEqual(true);

      // BTC - ETH
      await setChainLinkPrice(btcAddress, ethAddress, price);
      expect(await send(oracle, "_setAggregators", [[wbtcAddress], [btcAddress], [ethAddress]])).toSucceed();

      aggregator = await call(oracle, "aggregators", [wbtcAddress]);
      expect(aggregator.base).toEqual(btcAddress);
      expect(aggregator.quote).toEqual(ethAddress);
      expect(aggregator.isUsed).toEqual(true);
    });

    it("fails to set aggregators for non-admin", async () => {
      await expect(send(oracle, "_setAggregators", [[token._address], [token._address], [ethAddress]], {from: accounts[0]})).rejects.toRevert("revert only the admin may set the aggregators");
      expect(await send(oracle, "_setGuardian", [accounts[0]])).toSucceed();
    });

    it("fails to set aggregators for mismatched data", async () => {
      await expect(send(oracle, "_setAggregators", [[token._address], [token._address], []])).rejects.toRevert("revert mismatched data");
      await expect(send(oracle, "_setAggregators", [[token._address], [], [ethAddress]])).rejects.toRevert("revert mismatched data");
      await expect(send(oracle, "_setAggregators", [[], [token._address], [ethAddress]])).rejects.toRevert("revert mismatched data");
    });

    it("fails to set aggregators for unsupported denomination", async () => {
      await expect(send(oracle, "_setAggregators", [[token._address], [token._address], [address(1)]])).rejects.toRevert("revert unsupported denomination");
    });

    it("fails to set aggregators for aggregator not enabled", async () => {
      await send(registry, 'setFeedDisabled', [true]);
      await expect(send(oracle, "_setAggregators", [[token._address], [token._address], [ethAddress]])).rejects.toRevert("revert aggregator not enabled");
    });

    it("fails to set aggregators for invalid price", async () => {
      await expect(send(oracle, "_setAggregators", [[token._address], [token._address], [ethAddress]])).rejects.toRevert("revert invalid price");
    });

    it("clear aggregators successfully", async () => {
      expect(await send(oracle, "_setAggregators", [[token._address], [address(0)], [address(0)]])).toSucceed();

      const aggregator = await call(oracle, "aggregators", [token._address]);
      expect(aggregator.base).toEqual(address(0));
      expect(aggregator.quote).toEqual(address(0));
      expect(aggregator.isUsed).toEqual(false);
    });
  });

  describe('_disableAggregator', () => {
    const ethAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    let token;

    beforeEach(async () => {
      token = await makeToken();
    });

    it('disables aggregator successfully', async () => {
      await send(oracle, "_setGuardian", [accounts[0]]);

      const price = '100000000'; // 1e8

      // token - ETH
      await setChainLinkPrice(token._address, ethAddress, price);
      await send(oracle, "_setAggregators", [[token._address], [token._address], [ethAddress]]);

      expect(await send(oracle, "_disableAggregator", [token._address], {from: accounts[0]})).toSucceed();

      let aggregator = await call(oracle, "aggregators", [token._address]);
      expect(aggregator.base).toEqual(token._address);
      expect(aggregator.quote).toEqual(ethAddress);
      expect(aggregator.isUsed).toEqual(false);
    });

    it('fails to disable aggregator for not admin nor guardian', async () => {
      await expect(send(oracle, "_disableAggregator", [token._address], {from: accounts[0]})).rejects.toRevert("revert only the admin or guardian may disable the aggregator");
    });

    it('fails to disable aggregator for not used', async () => {
      await expect(send(oracle, "_disableAggregator", [token._address])).rejects.toRevert("revert aggregator not used");
    });
  });

  describe('_enableAggregator', () => {
    const ethAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    let token;

    beforeEach(async () => {
      token = await makeToken();
    });

    it('enables aggregator successfully', async () => {
      await send(oracle, "_setGuardian", [accounts[0]]);

      const price = '100000000'; // 1e8

      // token - ETH
      await setChainLinkPrice(token._address, ethAddress, price);
      await send(oracle, "_setAggregators", [[token._address], [token._address], [ethAddress]]);
      await send(oracle, "_disableAggregator", [token._address], {from: accounts[0]});

      expect(await send(oracle, "_enableAggregator", [token._address], {from: accounts[0]})).toSucceed();

      let aggregator = await call(oracle, "aggregators", [token._address]);
      expect(aggregator.base).toEqual(token._address);
      expect(aggregator.quote).toEqual(ethAddress);
      expect(aggregator.isUsed).toEqual(true);
    });

    it('fails to enable aggregator for not admin nor guardian', async () => {
      await expect(send(oracle, "_enableAggregator", [token._address], {from: accounts[0]})).rejects.toRevert("revert only the admin or guardian may enable the aggregator");
    });

    it('fails to enable aggregator for already used', async () => {
      const price = '100000000'; // 1e8

      // token - ETH
      await setChainLinkPrice(token._address, ethAddress, price);
      await send(oracle, "_setAggregators", [[token._address], [token._address], [ethAddress]]);

      await expect(send(oracle, "_enableAggregator", [token._address])).rejects.toRevert("revert aggregator is already used");
    });

    it('fails to enable aggregator for aggregator not enabled', async () => {
      const price = '100000000'; // 1e8

      // token - ETH
      await setChainLinkPrice(token._address, ethAddress, price);
      await send(oracle, "_setAggregators", [[token._address], [token._address], [ethAddress]]);
      await send(oracle, "_disableAggregator", [token._address]);

      await send(registry, 'setFeedDisabled', [true]);
      await expect(send(oracle, "_enableAggregator", [token._address])).rejects.toRevert("revert aggregator not enabled");
    });

    it('fails to enable aggregator for invalid price', async () => {
      const price = '100000000'; // 1e8

      // token - ETH
      await setChainLinkPrice(token._address, ethAddress, price);
      await send(oracle, "_setAggregators", [[token._address], [token._address], [ethAddress]]);
      await send(oracle, "_disableAggregator", [token._address]);

      await setChainLinkPrice(token._address, ethAddress, 0);
      await expect(send(oracle, "_enableAggregator", [token._address])).rejects.toRevert("revert invalid price");
    });
  });

  describe("_setReferences", () => {
    let token;
    let symbol;

    beforeEach(async () => {
      token = await makeToken();
      symbol = await call(token, "symbol");
    });

    it("set references successfully", async () => {
      const price = etherMantissa(1);
      await setBandPrice(token, price);
      expect(await send(oracle, "_setReferences", [[token._address], [symbol]])).toSucceed();

      const reference = await call(oracle, "references", [token._address]);
      expect(reference.symbol).toEqual(symbol);
      expect(reference.isUsed).toEqual(true);
    });

    it("fails to set references for non-admin", async () => {
      await expect(send(oracle, "_setReferences", [[token._address], [symbol]], {from: accounts[0]})).rejects.toRevert("revert only the admin may set the references");
      expect(await send(oracle, "_setGuardian", [accounts[0]])).toSucceed();
    });

    it("fails to set references for mismatched data", async () => {
      await expect(send(oracle, "_setReferences", [[token._address], []])).rejects.toRevert("revert mismatched data");
      await expect(send(oracle, "_setReferences", [[], [symbol]])).rejects.toRevert("revert mismatched data");
    });

    it("fails to set references for invalid price", async () => {
      await expect(send(oracle, "_setReferences", [[token._address], [symbol]])).rejects.toRevert("revert invalid price");
    });

    it("clear references successfully", async () => {
      expect(await send(oracle, "_setReferences", [[token._address], ['']])).toSucceed();

      const reference = await call(oracle, "references", [token._address]);
      expect(reference.symbol).toEqual('');
      expect(reference.isUsed).toEqual(false);
    });
  });

  describe('_disableReference', () => {
    let token;
    let symbol;

    beforeEach(async () => {
      token = await makeToken();
      symbol = await call(token, "symbol");
    });

    it('disables reference successfully', async () => {
      await send(oracle, "_setGuardian", [accounts[0]]);

      const price = etherMantissa(1);
      await setBandPrice(token, price);
      await send(oracle, "_setReferences", [[token._address], [symbol]]);

      expect(await send(oracle, "_disableReference", [token._address], {from: accounts[0]})).toSucceed();

      const reference = await call(oracle, "references", [token._address]);
      expect(reference.symbol).toEqual(symbol);
      expect(reference.isUsed).toEqual(false);
    });

    it('fails to disable reference for not admin nor guardian', async () => {
      await expect(send(oracle, "_disableReference", [token._address], {from: accounts[0]})).rejects.toRevert("revert only the admin or guardian may disable the reference");
    });

    it('fails to disable reference for not used', async () => {
      await expect(send(oracle, "_disableReference", [token._address])).rejects.toRevert("revert reference not used");
    });
  });

  describe('_enableReference', () => {
    let token;
    let symbol;

    beforeEach(async () => {
      token = await makeToken();
      symbol = await call(token, "symbol");
    });

    it('enables reference successfully', async () => {
      await send(oracle, "_setGuardian", [accounts[0]]);

      const price = etherMantissa(1);
      await setBandPrice(token, price);
      await send(oracle, "_setReferences", [[token._address], [symbol]]);
      await send(oracle, "_disableReference", [token._address], {from: accounts[0]});

      expect(await send(oracle, "_enableReference", [token._address], {from: accounts[0]})).toSucceed();

      const reference = await call(oracle, "references", [token._address]);
      expect(reference.symbol).toEqual(symbol);
      expect(reference.isUsed).toEqual(true);
    });

    it('fails to enable reference for not admin nor guardian', async () => {
      await expect(send(oracle, "_enableReference", [token._address], {from: accounts[0]})).rejects.toRevert("revert only the admin or guardian may enable the reference");
    });

    it('fails to enable reference for already used', async () => {
      const price = etherMantissa(1);
      await setBandPrice(token, price);
      await send(oracle, "_setReferences", [[token._address], [symbol]]);

      await expect(send(oracle, "_enableReference", [token._address])).rejects.toRevert("revert reference is already used");
    });

    it('fails to enable reference for invalid price', async () => {
      const price = etherMantissa(1);
      await setBandPrice(token, price);
      await send(oracle, "_setReferences", [[token._address], [symbol]]);
      await send(oracle, "_disableReference", [token._address]);

      await setBandPrice(token, 0);
      await expect(send(oracle, "_enableReference", [token._address])).rejects.toRevert("revert invalid price");
    });
  });

  describe("_updateDeprecatedMarkets", () => {
    let token;

    beforeEach(async () => {
      token = await makeToken();
    });

    it("update deprecated markets successfully", async () => {
      expect(await call(oracle, "deprecatedMarkets", [token._address])).toEqual(false);
      expect(await send(oracle, "_updateDeprecatedMarkets", [[token._address], [true]])).toSucceed();
      expect(await call(oracle, "deprecatedMarkets", [token._address])).toEqual(true);

      expect(await send(oracle, "_updateDeprecatedMarkets", [[token._address], [true]])).toSucceed(); // succeed but nothing change
      expect(await call(oracle, "deprecatedMarkets", [token._address])).toEqual(true);
    });

    it("fails to update deprecated markets for non-admin", async () => {
      await expect(send(oracle, "_updateDeprecatedMarkets", [[token._address], [true]], {from: accounts[0]})).rejects.toRevert("revert only the admin may update the deprecated markets");
    });

    it("fails to update deprecated markets for mismatched data", async () => {
      await expect(send(oracle, "_updateDeprecatedMarkets", [[token._address], []])).rejects.toRevert("revert mismatched data");
      await expect(send(oracle, "_updateDeprecatedMarkets", [[], [true]])).rejects.toRevert("revert mismatched data");
    });
  });
});
