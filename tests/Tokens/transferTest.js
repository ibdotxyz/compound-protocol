const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeCToken,
  preApprove,
  balanceOf,
  fastForward
} = require('../Utils/Compound');

const exchangeRate = 50e3;
const mintAmount = etherUnsigned(10e4);
const mintTokens = mintAmount.div(exchangeRate);

async function preMint(cToken, minter, mintAmount, exchangeRate) {
  await preApprove(cToken, minter, mintAmount);
  await send(cToken.comptroller, 'setMintAllowed', [true]);
  await send(cToken.comptroller, 'setMintVerify', [true]);
  await send(cToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(cToken.underlying, 'harnessSetFailTransferFromAddress', [minter, false]);
  await send(cToken, 'harnessSetBalance', [minter, 0]);
  await send(cToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function mintFresh(cToken, minter, mintAmount) {
  return send(cToken, 'harnessMintFresh', [minter, mintAmount]);
}

describe('CToken', function () {
  let root, minter, accounts;
  beforeEach(async () => {
    [root, minter, ...accounts] = saddle.accounts;
  });

  describe('transfer', () => {
    it("cannot transfer from a zero balance", async () => {
      const cToken = await makeCToken({supportMarket: true});
      expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(0);
      await expect(send(cToken, 'transfer', [accounts[0], 100])).rejects.toRevert('revert subtraction underflow');
    });

    it("transfers 50 tokens", async () => {
      const cToken = await makeCToken({supportMarket: true});
      await send(cToken, 'harnessSetBalance', [root, 100]);
      expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(100);
      await send(cToken, 'transfer', [accounts[0], 50]);
      expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(50);
      expect(await call(cToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
    });

    it("doesn't transfer when src == dst", async () => {
      const cToken = await makeCToken({supportMarket: true});
      await send(cToken, 'harnessSetBalance', [root, 100]);
      expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(100);
      await expect(send(cToken, 'transfer', [root, 50])).rejects.toRevert('revert bad input');
    });

    it("rejects transfer when not allowed and reverts if not verified", async () => {
      const cToken = await makeCToken({comptrollerOpts: {kind: 'bool'}});
      await send(cToken, 'harnessSetBalance', [root, 100]);
      expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(100);

      await send(cToken.comptroller, 'setTransferAllowed', [false])
      await expect(send(cToken, 'transfer', [root, 50])).rejects.toRevert('revert rejected');

      await send(cToken.comptroller, 'setTransferAllowed', [true])
      await send(cToken.comptroller, 'setTransferVerify', [false])
      await expect(send(cToken, 'transfer', [accounts[0], 50])).rejects.toRevert("revert transferVerify rejected transfer");
    });

    describe("transfer ccollateralcap token", () => {
      it("transfers collateral tokens", async () => {
        const cToken = await makeCToken({kind: 'ccollateralcap', supportMarket: true});
        await send(cToken, 'harnessSetBalance', [root, 100]);
        await send(cToken, 'harnessSetCollateralBalance', [root, 100]);
        await send(cToken, 'harnessSetTotalSupply', [100]);
        await send(cToken, 'harnessSetTotalCollateralTokens', [100]);

        expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(100);
        expect(await call(cToken, 'accountCollateralTokens', [root])).toEqualNumber(100);
        await send(cToken, 'transfer', [accounts[0], 50]);
        expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(50);
        expect(await call(cToken, 'accountCollateralTokens', [root])).toEqualNumber(50);
        expect(await call(cToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
        expect(await call(cToken, 'accountCollateralTokens', [accounts[0]])).toEqualNumber(50);
      });

      it("transfers non-collateral tokens", async () => {
        const cToken = await makeCToken({kind: 'ccollateralcap', supportMarket: true});
        await send(cToken, 'harnessSetBalance', [root, 100]);
        await send(cToken, 'harnessSetCollateralBalance', [root, 50]);
        await send(cToken, 'harnessSetTotalSupply', [100]);
        await send(cToken, 'harnessSetTotalCollateralTokens', [50]);

        expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(100);
        expect(await call(cToken, 'accountCollateralTokens', [root])).toEqualNumber(50);
        await send(cToken, 'transfer', [accounts[0], 50]);
        expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(50);
        expect(await call(cToken, 'accountCollateralTokens', [root])).toEqualNumber(50);
        expect(await call(cToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
        expect(await call(cToken, 'accountCollateralTokens', [accounts[0]])).toEqualNumber(0);
      });

      it("transfers partial collateral tokens", async () => {
        const cToken = await makeCToken({kind: 'ccollateralcap', supportMarket: true});
        await send(cToken, 'harnessSetBalance', [root, 100]);
        await send(cToken, 'harnessSetCollateralBalance', [root, 80]);
        await send(cToken, 'harnessSetTotalSupply', [100]);
        await send(cToken, 'harnessSetTotalCollateralTokens', [80]);

        expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(100);
        expect(await call(cToken, 'accountCollateralTokens', [root])).toEqualNumber(80);
        await send(cToken, 'transfer', [accounts[0], 50]);
        expect(await call(cToken, 'balanceOf', [root])).toEqualNumber(50);
        expect(await call(cToken, 'accountCollateralTokens', [root])).toEqualNumber(50);
        expect(await call(cToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
        expect(await call(cToken, 'accountCollateralTokens', [accounts[0]])).toEqualNumber(30);
      });
    })
  });
});
