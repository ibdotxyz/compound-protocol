const {
  etherMantissa
} = require('./Utils/Ethereum');

const {
  makeWstEth
} = require('./Utils/Compound');

describe('WstEthDelayOracle', () => {
  let root, accounts;
  let wstEth, oracle;

  let exchangeRate = etherMantissa(1.01);

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    wstEth = await makeWstEth();
    await send(wstEth, 'setStEthPerToken', [exchangeRate]);
    oracle = await deploy('MockWstEthDelayOracle', [root, wstEth._address]);
  });

  describe('constructor', () => {
    it('sets address of admin', async () => {
      const admin = await call(oracle, 'admin');
      expect(admin).toEqual(root);
    });

    it('sets initial price and candidate', async () => {
      const price = await call(oracle, 'getPrice');
      const candidate = await call(oracle, 'getCandidatePrice');
      expect(price).toEqual(exchangeRate.toFixed());
      expect(candidate).toEqual(exchangeRate.toFixed());
    })
  });

  describe('update', () => {
    it('updates successfully', async () => {
      const exchangeRate2 = etherMantissa(1.02);
      await send(wstEth, 'setStEthPerToken', [exchangeRate2]);
      const timestamp = '100000';
      await send(oracle, 'setTimestamp', [timestamp]);
      await send(oracle, 'update');

      const lastUpdated = await call(oracle, 'lastUpdated');
      expect(lastUpdated).toEqual(timestamp);
      const price = await call(oracle, 'getPrice');
      const candidate = await call(oracle, 'getCandidatePrice');
      expect(price).toEqual(exchangeRate.toFixed()); // unchange
      expect(candidate).toEqual(exchangeRate2.toFixed());

      const exchangeRate3 = etherMantissa(1.03);
      await send(wstEth, 'setStEthPerToken', [exchangeRate3]);
      const timestamp2 = '110000';
      await send(oracle, 'setTimestamp', [timestamp2]);
      await send(oracle, 'update');

      const lastUpdated2 = await call(oracle, 'lastUpdated');
      expect(lastUpdated2).toEqual(timestamp2);
      const price2 = await call(oracle, 'getPrice');
      const candidate2 = await call(oracle, 'getCandidatePrice');
      expect(price2).toEqual(exchangeRate2.toFixed());
      expect(candidate2).toEqual(exchangeRate3.toFixed());
    });

    it('updates successfully with candidate revoke', async () => {
      const exchangeRate2 = etherMantissa(1.02);
      await send(wstEth, 'setStEthPerToken', [exchangeRate2]);
      const timestamp = '100000';
      await send(oracle, 'setTimestamp', [timestamp]);
      await send(oracle, 'update');

      const lastUpdated = await call(oracle, 'lastUpdated');
      expect(lastUpdated).toEqual(timestamp);
      const price = await call(oracle, 'getPrice');
      const candidate = await call(oracle, 'getCandidatePrice');
      expect(price).toEqual(exchangeRate.toFixed()); // unchange
      expect(candidate).toEqual(exchangeRate2.toFixed());

      await send(oracle, 'revokeCandidate');

      const exchangeRate3 = etherMantissa(1.03);
      await send(wstEth, 'setStEthPerToken', [exchangeRate3]);
      const timestamp2 = '110000';
      await send(oracle, 'setTimestamp', [timestamp2]);
      await send(oracle, 'update');

      const lastUpdated2 = await call(oracle, 'lastUpdated');
      expect(lastUpdated2).toEqual(timestamp2);
      const price2 = await call(oracle, 'getPrice');
      const candidate2 = await call(oracle, 'getCandidatePrice');
      expect(price2).toEqual(exchangeRate.toFixed()); // unchange
      expect(candidate2).toEqual(exchangeRate3.toFixed());
    });

    it('fails to update for period not elapsed', async () => {
      await expect(send(oracle, 'update')).rejects.toRevert('revert period not elapsed');
    });

    it('fails to update for paused', async () => {
      await send(oracle, 'revokePrice');
      await expect(send(oracle, 'update')).rejects.toRevert('revert paused');
    });

    it('fails to update for invalid price', async () => {
      await send(wstEth, 'setStEthPerToken', [0]);
      const timestamp = '100000';
      await send(oracle, 'setTimestamp', [timestamp]);
      await expect(send(oracle, 'update')).rejects.toRevert('revert invalid price');
    });
  });

  describe('revokeCandidate', () => {
    it('revokes candidate successfully', async () => {
      await send(oracle, 'revokeCandidate');
      const candidate = await call(oracle, 'getCandidatePrice');
      expect(candidate).toEqual('0');
    });

    it('fails to revoke candidate for unauthorized', async () => {
      await expect(send(oracle, 'revokeCandidate', {from: accounts[0]})).rejects.toRevert('revert unauthorized');
    });
  });

  describe('revokePrice', () => {
    it('revokes price successfully', async () => {
      await send(oracle, 'revokePrice');
      const price = await call(oracle, 'getPrice');
      expect(price).toEqual('0');
      const candidate = await call(oracle, 'getCandidatePrice');
      expect(candidate).toEqual('0');
      const paused = await call(oracle, 'paused');
      expect(paused).toEqual(true);
    });

    it('fails to revoke price for unauthorized', async () => {
      await expect(send(oracle, 'revokePrice', {from: accounts[0]})).rejects.toRevert('revert unauthorized');
    });
  });

  describe('unpause', () => {
    it('unpauses successfully', async () => {
      await send(oracle, 'revokePrice');
      await send(oracle, 'unpause');
      const price = await call(oracle, 'getPrice');
      expect(price).toEqual(exchangeRate.toFixed());
      const candidate = await call(oracle, 'getCandidatePrice');
      expect(candidate).toEqual(exchangeRate.toFixed());
      const paused = await call(oracle, 'paused');
      expect(paused).toEqual(false);
    });

    it('fails to unpause for unauthorized', async () => {
      await expect(send(oracle, 'unpause', {from: accounts[0]})).rejects.toRevert('revert unauthorized');
    });
  });
});
