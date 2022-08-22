import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface ComptrollerMethods {
  getAccountLiquidity(string): Callable<{0: number, 1: number, 2: number}>
  getHypotheticalAccountLiquidity(account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Callable<{0: number, 1: number, 2: number}>
  membershipLength(string): Callable<string>
  checkMembership(user: string, cToken: string): Callable<string>
  getAssetsIn(string): Callable<string[]>
  admin(): Callable<string>
  oracle(): Callable<string>
  liquidationIncentiveMantissa(): Callable<number>
  closeFactorMantissa(): Callable<number>
  getBlockNumber(): Callable<number>
  setBlockNumber(encodedNumber): Sendable<number>
  collateralFactor(string): Callable<string>
  markets(string): Callable<{0: boolean, 1: number, 2?: number}>
  _setLiquidationIncentive(encodedNumber): Sendable<number>
  _supportMarket(string): Sendable<number>
  _supportMarket(string, encodedNumber): Sendable<number>
  _setPriceOracle(string): Sendable<number>
  _setCollateralFactor(string, encodedNumber): Sendable<number>
  _setCloseFactor(encodedNumber): Sendable<number>
  enterMarkets(markets: string[]): Sendable<number>
  exitMarket(market: string): Sendable<number>
  updateCTokenVersion(cToken: string, version: encodedNumber): Sendable<void>
  fastForward(encodedNumber): Sendable<number>
  _setPendingImplementation(string): Sendable<number>
  comptrollerImplementation(): Callable<string>
  unlist(string): Sendable<void>
  _delistMarket(market: string, force: boolean): Sendable<void>
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  _setGuardian(string): Sendable<number>
  guardian(): Callable<string>
  _setMintPaused(market: string, state: boolean): Sendable<boolean>
  _setBorrowPaused(market: string, state: boolean): Sendable<boolean>
  _setFlashloanPaused(market: string, state: boolean): Sendable<boolean>
  _setTransferPaused(string): Sendable<number>
  _setSeizePaused(string): Sendable<number>
  _mintGuardianPaused(): Callable<boolean>
  _borrowGuardianPaused(): Callable<boolean>
  transferGuardianPaused(): Callable<boolean>
  seizeGuardianPaused(): Callable<boolean>
  mintGuardianPaused(market: string): Callable<boolean>
  borrowGuardianPaused(market: string): Callable<boolean>
  _setMarketSupplyCaps(cTokens:string[], supplyCaps:encodedNumber[]): Sendable<void>
  supplyCapGuardian(): Callable<string>
  supplyCaps(string): Callable<string>
  _setMarketBorrowCaps(cTokens:string[], borrowCaps:encodedNumber[]): Sendable<void>
  borrowCapGuardian(): Callable<string>
  borrowCaps(string): Callable<string>
  _setCreditLimit(protocol: string, market: string, creditLimit: encodedNumber): Sendable<void>
}

export interface Comptroller extends Contract {
  methods: ComptrollerMethods
}
