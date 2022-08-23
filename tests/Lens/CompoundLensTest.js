const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');
const {
  makeComptroller,
  makeCToken,
  fastForward,
  quickMint,
  preApprove
} = require('../Utils/Compound');

const exchangeRate = 50e3;
const mintAmount = etherUnsigned(10e4);
const mintTokens = mintAmount.div(exchangeRate);

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

async function preMint(cToken, minter, mintAmount, mintTokens, exchangeRate) {
  await preApprove(cToken, minter, mintAmount);
  await send(cToken.comptroller, 'setMintAllowed', [true]);
  await send(cToken.comptroller, 'setMintVerify', [true]);
  await send(cToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(cToken.underlying, 'harnessSetFailTransferFromAddress', [minter, false]);
  await send(cToken, 'harnessSetBalance', [minter, 0]);
  await send(cToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

describe('CompoundLens', () => {
  let compoundLens;
  let acct;

  beforeEach(async () => {
    compoundLens = await deploy('CompoundLens');
    acct = accounts[0];
  });

  describe('cTokenMetadata', () => {
    it('is correct for a cErc20', async () => {
      let cErc20 = await makeCToken();
      await send(cErc20.comptroller, '_supportMarket', [cErc20._address, 0]);
      await send(cErc20.comptroller, '_setMarketSupplyCaps', [[cErc20._address], [100]]);
      await send(cErc20.comptroller, '_setMarketBorrowCaps', [[cErc20._address], [200]]);
      await send(cErc20.comptroller, '_setMintPaused', [cErc20._address, true]);
      await send(cErc20.comptroller, '_setBorrowPaused', [cErc20._address, true]);
      expect(
        cullTuple(await call(compoundLens, 'cTokenMetadata', [cErc20._address]))
      ).toEqual(
        {
          cToken: cErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          totalCollateralTokens: "0",
          isListed: true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(cErc20, 'underlying', []),
          cTokenDecimals: "8",
          underlyingDecimals: "18",
          version: "0",
          collateralCap: "0",
          underlyingPrice: "0",
          supplyPaused: true,
          borrowPaused: true,
          supplyCap: "100",
          borrowCap: "200"
        }
      );
    });

    it('is correct for crEth', async () => {
      let crEth = await makeCToken({kind: 'cether'});
      expect(
        cullTuple(await call(compoundLens, 'cTokenMetadata', [crEth._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        cToken: crEth._address,
        cTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        totalCollateralTokens: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
        version: "0",
        collateralCap: "0",
        underlyingPrice: "1000000000000000000",
        supplyPaused: false,
        borrowPaused: false,
        supplyCap: "0",
        borrowCap: "0"
      });
    });

    it('is correct for a cCollateralCapErc20', async () => {
      let cCollateralCapErc20 = await makeCToken({kind: 'ccollateralcap', supportMarket: true});
      expect(
        cullTuple(await call(compoundLens, 'cTokenMetadata', [cCollateralCapErc20._address]))
      ).toEqual(
        {
          cToken: cCollateralCapErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          totalCollateralTokens: "0",
          isListed: true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(cCollateralCapErc20, 'underlying', []),
          cTokenDecimals: "8",
          underlyingDecimals: "18",
          version: "1",
          collateralCap: "0",
          underlyingPrice: "0",
          supplyPaused: false,
          borrowPaused: false,
          supplyCap: "0",
          borrowCap: "0"
        }
      );
    });

    it('is correct for a cCollateralCapErc20 with collateral cap', async () => {
      let cCollateralCapErc20 = await makeCToken({kind: 'ccollateralcap', supportMarket: true});
      expect(await send(cCollateralCapErc20, '_setCollateralCap', [100])).toSucceed();
      expect(
        cullTuple(await call(compoundLens, 'cTokenMetadata', [cCollateralCapErc20._address]))
      ).toEqual(
        {
          cToken: cCollateralCapErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          totalCollateralTokens: "0",
          isListed: true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(cCollateralCapErc20, 'underlying', []),
          cTokenDecimals: "8",
          underlyingDecimals: "18",
          version: "1",
          collateralCap: "100",
          underlyingPrice: "0",
          supplyPaused: false,
          borrowPaused: false,
          supplyCap: "0",
          borrowCap: "0"
        }
      );
    });

    it('is correct for a cWrappedNative', async () => {
      let cWrappedNative = await makeCToken({kind: 'cwrapped', supportMarket: true});
      expect(
        cullTuple(await call(compoundLens, 'cTokenMetadata', [cWrappedNative._address]))
      ).toEqual(
        {
          cToken: cWrappedNative._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          totalCollateralTokens: "0",
          isListed: true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(cWrappedNative, 'underlying', []),
          cTokenDecimals: "8",
          underlyingDecimals: "18",
          version: "2",
          collateralCap: "0",
          underlyingPrice: "0",
          supplyPaused: false,
          borrowPaused: false,
          supplyCap: "0",
          borrowCap: "0"
        }
      );
    });

    it('is correct for a cWrappedNative with supply cap', async () => {
      let cWrappedNative = await makeCToken({kind: 'cwrapped', supportMarket: true});
      await send(cWrappedNative.comptroller, '_setMarketSupplyCaps', [[cWrappedNative._address], [100]]);
      expect(
        cullTuple(await call(compoundLens, 'cTokenMetadata', [cWrappedNative._address]))
      ).toEqual(
        {
          cToken: cWrappedNative._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          totalCollateralTokens: "0",
          isListed: true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(cWrappedNative, 'underlying', []),
          cTokenDecimals: "8",
          underlyingDecimals: "18",
          version: "2",
          collateralCap: "100", // collateralCap equals to supplyCap
          underlyingPrice: "0",
          supplyPaused: false,
          borrowPaused: false,
          supplyCap: "100",
          borrowCap: "0"
        }
      );
    });
  });

  describe('cTokenMetadataAll', () => {
    it('is correct for a cErc20 and cEther', async () => {
      let comptroller = await makeComptroller();
      let cErc20 = await makeCToken({comptroller: comptroller});
      let crEth = await makeCToken({kind: 'cether', comptroller: comptroller});
      let cCollateralCapErc20 = await makeCToken({kind: 'ccollateralcap', supportMarket: true, comptroller: comptroller});
      let cWrappedNative = await makeCToken({kind: 'cwrapped', supportMarket: true, comptroller: comptroller});
      expect(await send(cCollateralCapErc20, '_setCollateralCap', [100])).toSucceed();
      expect(
        (await call(compoundLens, 'cTokenMetadataAll', [[cErc20._address, crEth._address, cCollateralCapErc20._address, cWrappedNative._address]])).map(cullTuple)
      ).toEqual([
        {
          cToken: cErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          totalCollateralTokens: "0",
          isListed: false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(cErc20, 'underlying', []),
          cTokenDecimals: "8",
          underlyingDecimals: "18",
          version: "0",
          collateralCap: "0",
          underlyingPrice: "0",
          supplyPaused: false,
          borrowPaused: false,
          supplyCap: "0",
          borrowCap: "0"
        },
        {
          borrowRatePerBlock: "0",
          cToken: crEth._address,
          cTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCollateralTokens: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
          version: "0",
          collateralCap: "0",
          underlyingPrice: "1000000000000000000",
          supplyPaused: false,
          borrowPaused: false,
          supplyCap: "0",
          borrowCap: "0"
        },
        {
          borrowRatePerBlock: "0",
          cToken: cCollateralCapErc20._address,
          cTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: true,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCollateralTokens: "0",
          underlyingAssetAddress: await call(cCollateralCapErc20, 'underlying', []),
          underlyingDecimals: "18",
          version: "1",
          collateralCap: "100",
          underlyingPrice: "0",
          supplyPaused: false,
          borrowPaused: false,
          supplyCap: "0",
          borrowCap: "0"
        },
        {
          cToken: cWrappedNative._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          totalCollateralTokens: "0",
          isListed: true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(cWrappedNative, 'underlying', []),
          cTokenDecimals: "8",
          underlyingDecimals: "18",
          version: "2",
          collateralCap: "0",
          underlyingPrice: "0",
          supplyPaused: false,
          borrowPaused: false,
          supplyCap: "0",
          borrowCap: "0"
        }
      ]);
    });

    it('fails for mismatch comptroller', async () => {
      let comptroller = await makeComptroller();
      let comptroller2 = await makeComptroller();
      let cErc20 = await makeCToken({comptroller: comptroller});
      let crEth = await makeCToken({kind: 'cether', comptroller: comptroller});
      let cCollateralCapErc20 = await makeCToken({kind: 'ccollateralcap', supportMarket: true, comptroller: comptroller2}); // different comptroller
      let cWrappedNative = await makeCToken({kind: 'cwrapped', supportMarket: true, comptroller: comptroller2}); // different comptroller
      await expect(
        call(compoundLens, 'cTokenMetadataAll', [[cErc20._address, crEth._address, cCollateralCapErc20._address, cWrappedNative._address]])
      ).rejects.toRevert('revert mismatch comptroller');
    });

    it('fails for invalid input', async () => {
      await expect(
        call(compoundLens, 'cTokenMetadataAll', [[]])
      ).rejects.toRevert('revert invalid input');
    });
  });

  describe('cTokenBalances', () => {
    it('is correct for cERC20', async () => {
      let cErc20 = await makeCToken();
      let ethBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(compoundLens, 'cTokenBalances', [cErc20._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          cToken: cErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
          collateralEnabled: false,
          collateralBalance: "0",
          nativeTokenBalance: ethBalance
        }
      );
    });

    it('is correct for cETH', async () => {
      let cEth = await makeCToken({kind: 'cether'});
      let ethBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(compoundLens, 'cTokenBalances', [cEth._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          cToken: cEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
          collateralEnabled: false,
          collateralBalance: "0",
          nativeTokenBalance: ethBalance
        }
      );
    });

    it('is correct for cCollateralCapErc20', async () => {
      let cCollateralCapErc20 = await makeCToken({kind: 'ccollateralcap', comptrollerOpts: {kind: 'bool'}});
      await send(cCollateralCapErc20, 'harnessSetBalance', [acct, mintTokens]);
      await send(cCollateralCapErc20, 'harnessSetCollateralBalance', [acct, mintTokens]);
      await send(cCollateralCapErc20, 'harnessSetCollateralBalanceInit', [acct]);
      let ethBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(compoundLens, 'cTokenBalances', [cCollateralCapErc20._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "2",
          balanceOfUnderlying: "2",
          borrowBalanceCurrent: "0",
          cToken: cCollateralCapErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
          collateralEnabled: true,
          collateralBalance: "2",
          nativeTokenBalance: ethBalance
        }
      );
    });
  });

  describe('cTokenBalancesAll', () => {
    it('is correct for cEth and cErc20', async () => {
      let cErc20 = await makeCToken();
      let cEth = await makeCToken({kind: 'cether'});
      let ethBalance = await web3.eth.getBalance(acct);

      expect(
        (await call(compoundLens, 'cTokenBalancesAll', [[cErc20._address, cEth._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          cToken: cErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
          collateralEnabled: false,
          collateralBalance: "0",
          nativeTokenBalance: ethBalance
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          cToken: cEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
          collateralEnabled: false,
          collateralBalance: "0",
          nativeTokenBalance: ethBalance
        }
      ]);
    })
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(compoundLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });
});
