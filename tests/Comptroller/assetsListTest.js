const {both} = require('../Utils/Ethereum');
const {
  makeComptroller,
  makeCToken
} = require('../Utils/Compound');

describe('assetListTest', () => {
  let root, customer, accounts;
  let comptroller;
  let allTokens, OMG, ZRX, BAT, REP, DAI, SKT;

  beforeEach(async () => {
    [root, customer, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    allTokens = [OMG, ZRX, BAT, REP, DAI, SKT] = await Promise.all(
      ['OMG', 'ZRX', 'BAT', 'REP', 'DAI', 'sketch']
        .map(async (name) => makeCToken({comptroller, name, symbol: name, supportMarket: name != 'sketch', underlyingPrice: 0.5}))
    );
  });

  async function checkMarkets(expectedTokens) {
    for (let token of allTokens) {
      const isExpected = expectedTokens.some(e => e.symbol == token.symbol);
      expect(await call(comptroller, 'checkMembership', [customer, token._address])).toEqual(isExpected);
    }
  }

  async function failToEnterMarkets(enterTokens, expectedTokens, expectedError) {
    await expect(both(comptroller, 'enterMarkets', [enterTokens.map(t => t._address)], {from: customer})).rejects.toRevert(expectedError);

    const assetsIn = await call(comptroller, 'getAssetsIn', [customer]);
    expect(assetsIn).toEqual(expectedTokens.map(t => t._address));

    await checkMarkets(expectedTokens);
  }

  async function enterAndCheckMarkets(enterTokens, expectedTokens) {
    const {reply, receipt} = await both(comptroller, 'enterMarkets', [enterTokens.map(t => t._address)], {from: customer});
    const assetsIn = await call(comptroller, 'getAssetsIn', [customer]);
    const expectedErrors = enterTokens.map(_ => 'NO_ERROR');

    reply.forEach((tokenReply, i) => {
      expect(tokenReply).toHaveTrollError(expectedErrors[i]);
    });

    expect(receipt).toSucceed();
    expect(assetsIn).toEqual(expectedTokens.map(t => t._address));

    await checkMarkets(expectedTokens);

    return receipt;
  };

  async function failToExitMarkets(exitToken, expectedTokens, expectedError) {
    await expect(both(comptroller, 'exitMarket', [exitToken._address], {from: customer})).rejects.toRevert(expectedError);

    const assetsIn = await call(comptroller, 'getAssetsIn', [customer]);
    expect(assetsIn).toEqual(expectedTokens.map(t => t._address));

    await checkMarkets(expectedTokens);
  }

  async function exitAndCheckMarkets(exitToken, expectedTokens) {
    const {reply, receipt} = await both(comptroller, 'exitMarket', [exitToken._address], {from: customer});
    const assetsIn = await call(comptroller, 'getAssetsIn', [customer]);
    expect(reply).toHaveTrollError('NO_ERROR');
    expect(assetsIn).toEqual(expectedTokens.map(t => t._address));
    await checkMarkets(expectedTokens);
    return receipt;
  };

  describe('enterMarkets', () => {
    it("properly emits events", async () => {
      const result1 = await enterAndCheckMarkets([OMG], [OMG]);
      const result2 = await enterAndCheckMarkets([OMG], [OMG]);
      expect(result1).toHaveLog('MarketEntered', {
          cToken: OMG._address,
          account: customer
        });
      expect(result2.events).toEqual({});
    });

    it("adds to the asset list only once", async () => {
      await enterAndCheckMarkets([OMG], [OMG]);
      await enterAndCheckMarkets([OMG], [OMG]);
      await enterAndCheckMarkets([ZRX, BAT, OMG], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([ZRX, OMG], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([ZRX], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([OMG], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([ZRX], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([BAT], [OMG, ZRX, BAT]);
    });

    it("the market must be listed for add to succeed", async () => {
      await failToEnterMarkets([SKT], [], ['revert market not listed']);
      await send(comptroller, '_supportMarket', [SKT._address, 0]);
      await enterAndCheckMarkets([SKT], [SKT]);
    });

    it("returns a list of codes mapping to user's ultimate membership in given addresses", async () => {
      await enterAndCheckMarkets([OMG, ZRX, BAT], [OMG, ZRX, BAT], ['NO_ERROR', 'NO_ERROR', 'NO_ERROR']);
      await failToEnterMarkets([OMG, SKT], [OMG, ZRX, BAT], ['revert market not listed']);
    });
  });

  describe('exitMarket', () => {
    it("doesn't let you exit if you have a borrow balance", async () => {
      await enterAndCheckMarkets([OMG], [OMG]);
      await send(OMG, 'harnessSetAccountBorrows', [customer, 1, 1]);
      await failToExitMarkets(OMG, [OMG], 'revert nonzero borrow balance');
    });

    it("rejects unless redeem allowed", async () => {
      await enterAndCheckMarkets([OMG, BAT], [OMG, BAT]);
      await send(BAT, 'harnessSetAccountBorrows', [customer, 1, 1]);

      // BAT has a negative balance and there's no supply, thus account should be underwater
      await failToExitMarkets(OMG, [OMG, BAT], 'revert insufficient liquidity');
    });

    it("accepts when you're not in the market already", async () => {
      await enterAndCheckMarkets([OMG, BAT], [OMG, BAT]);

      // Not in ZRX, should exit fine
      await exitAndCheckMarkets(ZRX, [OMG, BAT]);
    });

    it("properly removes when there's only one asset", async () => {
      await enterAndCheckMarkets([OMG], [OMG]);
      await exitAndCheckMarkets(OMG, []);
    });

    it("properly removes when there's only two assets, removing the first", async () => {
      await enterAndCheckMarkets([OMG, BAT], [OMG, BAT]);
      await exitAndCheckMarkets(OMG, [BAT]);
    });

    it("properly removes when there's only two assets, removing the second", async () => {
      await enterAndCheckMarkets([OMG, BAT], [OMG, BAT]);
      await exitAndCheckMarkets(BAT, [OMG]);
    });

    it("properly removes when there's only three assets, removing the first", async () => {
      await enterAndCheckMarkets([OMG, BAT, ZRX], [OMG, BAT, ZRX]);
      await exitAndCheckMarkets(OMG, [ZRX, BAT]);
    });

    it("properly removes when there's only three assets, removing the second", async () => {
      await enterAndCheckMarkets([OMG, BAT, ZRX], [OMG, BAT, ZRX]);
      await exitAndCheckMarkets(BAT, [OMG, ZRX]);
    });

    it("properly removes when there's only three assets, removing the third", async () => {
      await enterAndCheckMarkets([OMG, BAT, ZRX], [OMG, BAT, ZRX]);
      await exitAndCheckMarkets(ZRX, [OMG, BAT]);
    });
  });

  describe('entering from borrowAllowed', () => {
    it("enters when called by a ctoken", async () => {
      await send(BAT, 'harnessCallBorrowAllowed', [1], {from: customer});

      const assetsIn = await call(comptroller, 'getAssetsIn', [customer]);

      expect([BAT._address]).toEqual(assetsIn);

      await checkMarkets([BAT]);
    });

    it("reverts when called by not a ctoken", async () => {
      await expect(
        send(comptroller, 'borrowAllowed', [BAT._address, customer, 1], {from: customer})
      ).rejects.toRevert('revert sender must be cToken');

      const assetsIn = await call(comptroller, 'getAssetsIn', [customer]);

      expect([]).toEqual(assetsIn);

      await checkMarkets([]);
    });

    it("adds to the asset list only once", async () => {
      await send(BAT, 'harnessCallBorrowAllowed', [1], {from: customer});

      await enterAndCheckMarkets([BAT], [BAT]);

      await send(BAT, 'harnessCallBorrowAllowed', [1], {from: customer});
      const assetsIn = await call(comptroller, 'getAssetsIn', [customer]);
      expect([BAT._address]).toEqual(assetsIn);
    });
  });
});
