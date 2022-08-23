const { address, both, etherMantissa } = require('../Utils/Ethereum');
const { makeComptroller, makeCToken } = require('../Utils/Compound');

describe('Comptroller', () => {
  let comptroller, cToken;
  let root, accounts;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe("_setGuardian", () => {
    beforeEach(async () => {
      comptroller = await makeComptroller();
    });

    describe("failing", () => {
      it("emits a failure log if not sent by admin", async () => {
        let result = await send(comptroller, '_setGuardian', [root], {from: accounts[1]});
        expect(result).toHaveTrollFailure('UNAUTHORIZED', 'SET_PAUSE_GUARDIAN_OWNER_CHECK');
      });

      it("does not change the guardian", async () => {
        let guardian = await call(comptroller, 'guardian');
        expect(guardian).toEqual(address(0));
        await send(comptroller, '_setGuardian', [root], {from: accounts[1]});

        guardian = await call(comptroller, 'guardian');
        expect(guardian).toEqual(address(0));
      });
    });


    describe('succesfully changing guardian', () => {
      let result;

      beforeEach(async () => {
        comptroller = await makeComptroller();

        result = await send(comptroller, '_setGuardian', [accounts[1]]);
      });

      it('emits new guardian event', async () => {
        expect(result).toHaveLog(
          'NewGuardian',
          {newGuardian: accounts[1], oldGuardian: address(0)}
        );
      });

      it('changes pending guardian', async () => {
        let guardian = await call(comptroller, 'guardian');
        expect(guardian).toEqual(accounts[1]);
      });
    });
  });

  describe('setting paused', () => {
    beforeEach(async () => {
      cToken = await makeCToken({supportMarket: true});
      comptroller = cToken.comptroller;
    });

    let globalMethods = ["Transfer", "Seize"];
    describe('succeeding', () => {
      let guardian;
      beforeEach(async () => {
        guardian = accounts[1];
        await send(comptroller, '_setGuardian', [accounts[1]], {from: root});
      });

      globalMethods.forEach(async (method) => {
        it(`only guardian or admin can pause ${method}`, async () => {
          await expect(send(comptroller, `_set${method}Paused`, [true], {from: accounts[2]})).rejects.toRevert("revert guardian or admin only");
          await expect(send(comptroller, `_set${method}Paused`, [false], {from: accounts[2]})).rejects.toRevert("revert guardian or admin only");
        });

        it(`Guardian can pause of ${method}GuardianPaused`, async () => {
          result = await send(comptroller, `_set${method}Paused`, [true], {from: guardian});
          expect(result).toHaveLog(`ActionPaused`, {action: method, pauseState: true});

          let camelCase = method.charAt(0).toLowerCase() + method.substring(1);

          state = await call(comptroller, `${camelCase}GuardianPaused`);
          expect(state).toEqual(true);

          await expect(send(comptroller, `_set${method}Paused`, [false], {from: guardian})).rejects.toRevert("revert admin only");
          result = await send(comptroller, `_set${method}Paused`, [false]);

          expect(result).toHaveLog(`ActionPaused`, {action: method, pauseState: false});

          state = await call(comptroller, `${camelCase}GuardianPaused`);
          expect(state).toEqual(false);
        });

        it(`pauses ${method}`, async() => {
          await send(comptroller, `_set${method}Paused`, [true], {from: guardian});
          switch (method) {
          case "Transfer":
            await expect(
              send(comptroller, 'transferAllowed', [address(1), address(2), address(3), 1])
            ).rejects.toRevert(`revert ${method.toLowerCase()} is paused`);
            break;

          case "Seize":
            await expect(
              send(comptroller, 'seizeAllowed', [address(1), address(2), address(3), address(4), 1])
            ).rejects.toRevert(`revert ${method.toLowerCase()} is paused`);
            break;

          default:
            break;
          }
        });
      });
    });

    let marketMethods = ["Borrow", "Mint", "Flashloan"];
    describe('succeeding', () => {
      let guardian;
      beforeEach(async () => {
        guardian = accounts[1];
        await send(comptroller, '_setGuardian', [accounts[1]], {from: root});
      });

      marketMethods.forEach(async (method) => {
        it(`only guardian or admin can pause ${method}`, async () => {
          await expect(send(comptroller, `_set${method}Paused`, [cToken._address, true], {from: accounts[2]})).rejects.toRevert("revert guardian or admin only");
          await expect(send(comptroller, `_set${method}Paused`, [cToken._address, false], {from: accounts[2]})).rejects.toRevert("revert guardian or admin only");
        });

        it(`Guardian can pause of ${method}GuardianPaused`, async () => {
          result = await send(comptroller, `_set${method}Paused`, [cToken._address, true], {from: guardian});
          expect(result).toHaveLog(`ActionPaused`, {cToken: cToken._address, action: method, pauseState: true});

          let camelCase = method.charAt(0).toLowerCase() + method.substring(1);

          state = await call(comptroller, `${camelCase}GuardianPaused`, [cToken._address]);
          expect(state).toEqual(true);

          await expect(send(comptroller, `_set${method}Paused`, [cToken._address, false], {from: guardian})).rejects.toRevert("revert admin only");
          result = await send(comptroller, `_set${method}Paused`, [cToken._address, false]);

          expect(result).toHaveLog(`ActionPaused`, {cToken: cToken._address, action: method, pauseState: false});

          state = await call(comptroller, `${camelCase}GuardianPaused`, [cToken._address]);
          expect(state).toEqual(false);
        });

        it(`pauses ${method}`, async() => {
          await send(comptroller, `_set${method}Paused`, [cToken._address, true], {from: guardian});
          switch (method) {
          case "Mint":
            await expect(call(comptroller, 'mintAllowed', [address(1), address(2), 1])).rejects.toRevert('revert market not listed');
            await expect(send(comptroller, 'mintAllowed', [cToken._address, address(2), 1])).rejects.toRevert(`revert ${method.toLowerCase()} is paused`);
            break;

          case "Borrow":
            await expect(call(comptroller, 'borrowAllowed', [address(1), address(2), 1])).rejects.toRevert('revert market not listed');
            await expect(send(comptroller, 'borrowAllowed', [cToken._address, address(2), 1])).rejects.toRevert(`revert ${method.toLowerCase()} is paused`);
            break;

          default:
            break;
          }
        });
      });
    });
  });
});
