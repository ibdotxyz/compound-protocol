const {
  etherUnsigned
} = require('../Utils/Ethereum');

const {
  makeCToken
} = require('../Utils/Compound');

const amount = etherUnsigned(10e4);

describe('CToken', function () {
  let cToken, root, admin, accounts;
  beforeEach(async () => {
    [root, admin, ...accounts] = saddle.accounts;
  });

  describe('cErc20 to cCapable', () => {
    let cCapableDelegate;
    beforeEach(async () => {
      cToken = await makeCToken({comptrollerOpts: {kind: 'bool'}});
      cCapableDelegate = await deploy('CCapableErc20Delegate');
    });

    it("fails due to non admin", async () => {
      cToken = await saddle.getContractAt('CErc20Delegator', cToken._address);
      await expect(send(cToken, '_setImplementation', [cCapableDelegate._address, true, '0x0'], { from: accounts[0] })).rejects.toRevert("revert CErc20Delegator::_setImplementation: Caller must be admin");
    });

    it("succeeds to have internal cash", async () => {
      await send(cToken.underlying, 'harnessSetBalance', [cToken._address, amount]);

      cToken = await saddle.getContractAt('CErc20Delegator', cToken._address);
      expect(await send(cToken, '_setImplementation', [cCapableDelegate._address, true, '0x0'])).toSucceed();

      cToken = await saddle.getContractAt('CCapableErc20Delegate', cToken._address);
      const result = await call(cToken, 'getCash');
      expect(result).toEqualNumber(amount);
    });
  });

  describe('cErc20 to cCollateralCap', () => {
    let cCollateralCapDelegate;
    beforeEach(async () => {
      cToken = await makeCToken({comptrollerOpts: {kind: 'bool'}});
      cCollateralCapDelegate = await deploy('CCollateralCapErc20Delegate');
    });

    it("fails due to non admin", async () => {
      cToken = await saddle.getContractAt('CErc20Delegator', cToken._address);
      await expect(send(cToken, '_setImplementation', [cCollateralCapDelegate._address, true, '0x0'], { from: accounts[0] })).rejects.toRevert("revert CErc20Delegator::_setImplementation: Caller must be admin");
    });

    it("succeeds to have internal cash", async () => {
      await send(cToken.underlying, 'harnessSetBalance', [cToken._address, amount]);

      cToken = await saddle.getContractAt('CErc20Delegator', cToken._address);
      expect(await send(cToken, '_setImplementation', [cCollateralCapDelegate._address, true, '0x0'])).toSucceed();

      cToken = await saddle.getContractAt('CCollateralCapErc20Delegate', cToken._address);
      const result = await call(cToken, 'getCash');
      expect(result).toEqualNumber(amount);
    });
  });

  describe('cCapable to cCollateralCap', () => {
    let cCollateralCapDelegate;
    beforeEach(async () => {
      cToken = await makeCToken({kind: 'ccapable', comptrollerOpts: {kind: 'bool'}});
      cCollateralCapDelegate = await deploy('CCollateralCapErc20Delegate');
    });

    it("fails due to non admin", async () => {
      cToken = await saddle.getContractAt('CErc20Delegator', cToken._address);
      await expect(send(cToken, '_setImplementation', [cCollateralCapDelegate._address, true, '0x0'], { from: accounts[0] })).rejects.toRevert("revert CErc20Delegator::_setImplementation: Caller must be admin");
    });

    it("succeeds to update internal cash", async () => {
      await send(cToken.underlying, 'harnessSetBalance', [cToken._address, amount]);

      cToken = await saddle.getContractAt('CErc20Delegator', cToken._address);
      expect(await send(cToken, '_setImplementation', [cCollateralCapDelegate._address, true, '0x0'])).toSucceed();

      cToken = await saddle.getContractAt('CCollateralCapErc20Delegate', cToken._address);
      const result = await call(cToken, 'getCash');
      expect(result).toEqualNumber(amount);
    });
  });

  describe('cWrappedNative to cWrappedNative', () => {
    let cWrappedNativeDelegate;
    beforeEach(async () => {
      cToken = await makeCToken({kind: 'cwrapped', comptrollerOpts: {kind: 'bool'}});
      cWrappedNativeDelegate = await deploy('CWrappedNativeDelegate');
    });

    it("fails due to non admin", async () => {
      cToken = await saddle.getContractAt('CWrappedNativeDelegator', cToken._address);
      await expect(send(cToken, '_setImplementation', [cWrappedNativeDelegate._address, true, '0x0'], { from: accounts[0] })).rejects.toRevert("revert CWrappedNativeDelegator::_setImplementation: Caller must be admin");
    });

    it("succeeds to update internal cash", async () => {
      await send(cToken.underlying, 'harnessSetBalance', [cToken._address, amount]);

      cToken = await saddle.getContractAt('CWrappedNativeDelegator', cToken._address);
      expect(await send(cToken, '_setImplementation', [cWrappedNativeDelegate._address, true, '0x0'])).toSucceed();

      cToken = await saddle.getContractAt('CWrappedNativeDelegate', cToken._address);
      const result = await call(cToken, 'getCash');
      expect(result).toEqualNumber(amount);
    });
  });
});
