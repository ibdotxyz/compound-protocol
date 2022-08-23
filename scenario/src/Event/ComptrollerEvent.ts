import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {Comptroller} from '../Contract/Comptroller';
import {CToken} from '../Contract/CToken';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getBoolV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getPercentV,
  getStringV,
  getCoreValue
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildComptrollerImpl} from '../Builder/ComptrollerImplBuilder';
import {ComptrollerErrorReporter} from '../ErrorReporter';
import {getComptroller, getComptrollerImpl} from '../ContractLookup';
import {getLiquidity} from '../Value/ComptrollerValue';
import {getCTokenV} from '../Value/CTokenValue';
import {encodeABI, rawValues} from "../Utils";

async function genComptroller(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, comptrollerImpl: comptroller, comptrollerImplData: comptrollerData} = await buildComptrollerImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added Comptroller (${comptrollerData.description}) at address ${comptroller._address}`,
    comptrollerData.invokation
  );

  return world;
};

async function setPaused(world: World, from: string, comptroller: Comptroller, actionName: string, cToken: CToken, isPaused: boolean): Promise<World> {
  const pauseMap = {
    "Mint": comptroller.methods._setMintPaused,
    "Borrow": comptroller.methods._setBorrowPaused,
    "Flashloan": comptroller.methods._setFlashloanPaused
  };

  if (!pauseMap[actionName]) {
    throw `Cannot find pause function for action "${actionName}"`;
  }

  let invokation = await invoke(world, pauseMap[actionName](cToken._address, isPaused), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: set paused for ${actionName} ${cToken.name} to ${isPaused}`,
    invokation
  );

  return world;
}

async function setLiquidationIncentive(world: World, from: string, comptroller: Comptroller, liquidationIncentive: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setLiquidationIncentive(liquidationIncentive.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set liquidation incentive to ${liquidationIncentive.show()}`,
    invokation
  );

  return world;
}

async function oldSupportMarket(world: World, from: string, comptroller: Comptroller, cToken: CToken): Promise<World> {
  if (world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world.printer.printLine(`Dry run: Supporting market  \`${cToken._address}\``);
    return world;
  }

  let invokation = await invoke(world, comptroller.methods._supportMarket(cToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Supported market ${cToken.name}`,
    invokation
  );

  return world;
}

async function supportMarket(world: World, from: string, comptroller: Comptroller, cToken: CToken, version: NumberV): Promise<World> {
  if (world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world.printer.printLine(`Dry run: Supporting market  \`${cToken._address}\``);
    return world;
  }

  let invokation = await invoke(world, comptroller.methods._supportMarket(cToken._address, version.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Supported market ${cToken.name}`,
    invokation
  );

  return world;
}

async function unlistMarket(world: World, from: string, comptroller: Comptroller, cToken: CToken, force: boolean): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._delistMarket(cToken._address, force), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Unlisted market ${cToken.name}`,
    invokation
  );

  return world;
}

async function enterMarkets(world: World, from: string, comptroller: Comptroller, assets: string[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.enterMarkets(assets), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called enter assets ${assets} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function exitMarket(world: World, from: string, comptroller: Comptroller, asset: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.exitMarket(asset), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called exit market ${asset} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function updateCTokenVersion(world: World, from: string, comptroller: Comptroller, cToken: CToken, version: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.updateCTokenVersion(cToken._address, version.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Update market ${cToken.name} version to ${version.show()}`,
    invokation
  );

  return world;
}

async function setPriceOracle(world: World, from: string, comptroller: Comptroller, priceOracleAddr: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPriceOracle(priceOracleAddr), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set price oracle for to ${priceOracleAddr} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setCollateralFactor(world: World, from: string, comptroller: Comptroller, cToken: CToken, collateralFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCollateralFactor(cToken._address, collateralFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set collateral factor for ${cToken.name} to ${collateralFactor.show()}`,
    invokation
  );

  return world;
}

async function setCloseFactor(world: World, from: string, comptroller: Comptroller, closeFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCloseFactor(closeFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set close factor to ${closeFactor.show()}`,
    invokation
  );

  return world;
}

async function fastForward(world: World, from: string, comptroller: Comptroller, blocks: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.fastForward(blocks.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Fast forward ${blocks.show()} blocks to #${invokation.value}`,
    invokation
  );

  return world;
}

async function printLiquidity(world: World, comptroller: Comptroller): Promise<World> {
  let enterEvents = await getPastEvents(world, comptroller, 'StdComptroller', 'MarketEntered');
  let addresses = enterEvents.map((event) => event.returnValues['account']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Liquidity:")

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, comptroller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

async function setPendingAdmin(world: World, from: string, comptroller: Comptroller, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPendingAdmin(newPendingAdmin), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, comptroller: Comptroller): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._acceptAdmin(), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function setGuardian(world: World, from: string, comptroller: Comptroller, newPauseGuardian: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setGuardian(newPauseGuardian), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets guardian to ${newPauseGuardian}`,
    invokation
  );

  return world;
}

async function setGuardianPaused(world: World, from: string, comptroller: Comptroller, action: string, state: boolean): Promise<World> {
  let fun;
  switch(action){
    case "Transfer":
      fun = comptroller.methods._setTransferPaused
      break;
    case "Seize":
      fun = comptroller.methods._setSeizePaused
      break;
  }
  let invokation = await invoke(world, fun(state), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets ${action} paused`,
    invokation
  );

  return world;
}

async function setGuardianMarketPaused(world: World, from: string, comptroller: Comptroller, cToken: CToken, action: string, state: boolean): Promise<World> {
  let fun;
  switch(action){
    case "Mint":
      fun = comptroller.methods._setMintPaused
      break;
    case "Borrow":
      fun = comptroller.methods._setBorrowPaused
      break;
  }
  let invokation = await invoke(world, fun(cToken._address, state), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets ${action} paused`,
    invokation
  );

  return world;
}

async function setMarketSupplyCaps(world: World, from: string, comptroller: Comptroller, cTokens: CToken[], supplyCaps: NumberV[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setMarketSupplyCaps(cTokens.map(c => c._address), supplyCaps.map(c => c.encode())), from, ComptrollerErrorReporter);

  world = addAction(
      world,
      `Supply caps on ${cTokens} set to ${supplyCaps}`,
      invokation
  );

  return world;
}

async function setMarketBorrowCaps(world: World, from: string, comptroller: Comptroller, cTokens: CToken[], borrowCaps: NumberV[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setMarketBorrowCaps(cTokens.map(c => c._address), borrowCaps.map(c => c.encode())), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Borrow caps on ${cTokens} set to ${borrowCaps}`,
    invokation
  );

  return world;
}

async function setBlockNumber(world: World, from: string, comptroller: Comptroller, blockNumber: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.setBlockNumber(blockNumber.encode()), from, ComptrollerErrorReporter);

  return addAction(
    world,
    `Set Governor blockNumber to ${blockNumber.show()}`,
    invokation
  );

  return world;
}

async function setCreditLimit(world: World, from: string, comptroller: Comptroller, protocol: string, market: string, creditLimit: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCreditLimit(protocol, market, creditLimit.encode()), from, ComptrollerErrorReporter);

  return addAction(
    world,
    `Set ${market} credit limit of ${protocol} to ${creditLimit.show()}`,
    invokation
  );
}

export function comptrollerCommands() {
  return [
    new Command<{comptrollerParams: EventV}>(`
        #### Deploy

        * "Comptroller Deploy ...comptrollerParams" - Generates a new Comptroller (not as Impl)
          * E.g. "Comptroller Deploy YesNo"
      `,
      "Deploy",
      [new Arg("comptrollerParams", getEventV, {variadic: true})],
      (world, from, {comptrollerParams}) => genComptroller(world, from, comptrollerParams.val)
    ),
    new Command<{comptroller: Comptroller, action: StringV, cToken: CToken, isPaused: BoolV}>(`
        #### SetPaused

        * "Comptroller SetPaused <Action> <CToken> <Bool>" - Pauses or unpaused given cToken function
          * E.g. "Comptroller SetPaused "Mint" cZRX True"
      `,
      "SetPaused",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("action", getStringV),
        new Arg("cToken", getCTokenV),
        new Arg("isPaused", getBoolV)
      ],
      (world, from, {comptroller, action, cToken, isPaused}) => setPaused(world, from, comptroller, action.val, cToken, isPaused.val)
    ),
    new Command<{comptroller: Comptroller, cToken: CToken}>(`
        #### OldSupportMarket

        * "Comptroller OldSupportMarket <CToken>" - Adds support in the Comptroller for the given cToken
          * E.g. "Comptroller OldSupportMarket cZRX"
      `,
      "OldSupportMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV)
      ],
      (world, from, {comptroller, cToken}) => oldSupportMarket(world, from, comptroller, cToken)
    ),
    new Command<{comptroller: Comptroller, cToken: CToken, version: NumberV}>(`
        #### SupportMarket

        * "Comptroller SupportMarket <CToken> <Number>" - Adds support in the Comptroller for the given cToken
          * E.g. "Comptroller SupportMarket cZRX 0"
      `,
      "SupportMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV),
        new Arg("version", getNumberV)
      ],
      (world, from, {comptroller, cToken, version}) => supportMarket(world, from, comptroller, cToken, version)
    ),
    new Command<{comptroller: Comptroller, cToken: CToken, force: BoolV}>(`
        #### UnList

        * "Comptroller UnList <CToken> <Bool>" - Mock unlists a given market in tests
          * E.g. "Comptroller UnList cZRX True"
      `,
      "UnList",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV),
        new Arg("force", getBoolV)
      ],
      (world, from, {comptroller, cToken, force}) => unlistMarket(world, from, comptroller, cToken, force.val)
    ),
    new Command<{comptroller: Comptroller, cTokens: CToken[]}>(`
        #### EnterMarkets

        * "Comptroller EnterMarkets (<CToken> ...)" - User enters the given markets
          * E.g. "Comptroller EnterMarkets (cZRX cETH)"
      `,
      "EnterMarkets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cTokens", getCTokenV, {mapped: true})
      ],
      (world, from, {comptroller, cTokens}) => enterMarkets(world, from, comptroller, cTokens.map((c) => c._address))
    ),
    new Command<{comptroller: Comptroller, cToken: CToken}>(`
        #### ExitMarket

        * "Comptroller ExitMarket <CToken>" - User exits the given markets
          * E.g. "Comptroller ExitMarket cZRX"
      `,
      "ExitMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV)
      ],
      (world, from, {comptroller, cToken}) => exitMarket(world, from, comptroller, cToken._address)
    ),
    new Command<{comptroller: Comptroller, cToken: CToken, version: NumberV}>(`
        #### UpdateCTokenVersion

        * "Comptroller UpdateCTokenVersion <CToken> <Number>" - Update a CToken's version
          * E.g. "Comptroller UpdateCTokenVersion cZRX 1"
      `,
      "UpdateCTokenVersion",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV),
        new Arg("version", getNumberV)
      ],
      (world, from, {comptroller, cToken, version}) => updateCTokenVersion(world, from, comptroller, cToken, version)
    ),
    new Command<{comptroller: Comptroller, liquidationIncentive: NumberV}>(`
        #### LiquidationIncentive

        * "Comptroller LiquidationIncentive <Number>" - Sets the liquidation incentive
          * E.g. "Comptroller LiquidationIncentive 1.1"
      `,
      "LiquidationIncentive",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("liquidationIncentive", getExpNumberV)
      ],
      (world, from, {comptroller, liquidationIncentive}) => setLiquidationIncentive(world, from, comptroller, liquidationIncentive)
    ),
    new Command<{comptroller: Comptroller, priceOracle: AddressV}>(`
        #### SetPriceOracle

        * "Comptroller SetPriceOracle oracle:<Address>" - Sets the price oracle address
          * E.g. "Comptroller SetPriceOracle 0x..."
      `,
      "SetPriceOracle",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("priceOracle", getAddressV)
      ],
      (world, from, {comptroller, priceOracle}) => setPriceOracle(world, from, comptroller, priceOracle.val)
    ),
    new Command<{comptroller: Comptroller, cToken: CToken, collateralFactor: NumberV}>(`
        #### SetCollateralFactor

        * "Comptroller SetCollateralFactor <CToken> <Number>" - Sets the collateral factor for given cToken to number
          * E.g. "Comptroller SetCollateralFactor cZRX 0.1"
      `,
      "SetCollateralFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV),
        new Arg("collateralFactor", getExpNumberV)
      ],
      (world, from, {comptroller, cToken, collateralFactor}) => setCollateralFactor(world, from, comptroller, cToken, collateralFactor)
    ),
    new Command<{comptroller: Comptroller, closeFactor: NumberV}>(`
        #### SetCloseFactor

        * "Comptroller SetCloseFactor <Number>" - Sets the close factor to given percentage
          * E.g. "Comptroller SetCloseFactor 0.2"
      `,
      "SetCloseFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("closeFactor", getPercentV)
      ],
      (world, from, {comptroller, closeFactor}) => setCloseFactor(world, from, comptroller, closeFactor)
    ),
    new Command<{comptroller: Comptroller, newPendingAdmin: AddressV}>(`
        #### SetPendingAdmin

        * "Comptroller SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the Comptroller
          * E.g. "Comptroller SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, {comptroller, newPendingAdmin}) => setPendingAdmin(world, from, comptroller, newPendingAdmin.val)
    ),
    new Command<{comptroller: Comptroller}>(`
        #### AcceptAdmin

        * "Comptroller AcceptAdmin" - Accepts admin for the Comptroller
          * E.g. "From Geoff (Comptroller AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, from, {comptroller}) => acceptAdmin(world, from, comptroller)
    ),
    new Command<{comptroller: Comptroller, newPauseGuardian: AddressV}>(`
        #### SetGuardian

        * "Comptroller SetGuardian newPauseGuardian:<Address>" - Sets the Guardian for the Comptroller
          * E.g. "Comptroller SetGuardian Geoff"
      `,
      "SetGuardian",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newPauseGuardian", getAddressV)
      ],
      (world, from, {comptroller, newPauseGuardian}) => setGuardian(world, from, comptroller, newPauseGuardian.val)
    ),

    new Command<{comptroller: Comptroller, action: StringV, isPaused: BoolV}>(`
        #### SetGuardianPaused

        * "Comptroller SetGuardianPaused <Action> <Bool>" - Pauses or unpaused given cToken function
        * E.g. "Comptroller SetGuardianPaused "Transfer" True"
        `,
        "SetGuardianPaused",
        [
          new Arg("comptroller", getComptroller, {implicit: true}),
          new Arg("action", getStringV),
          new Arg("isPaused", getBoolV)
        ],
        (world, from, {comptroller, action, isPaused}) => setGuardianPaused(world, from, comptroller, action.val, isPaused.val)
    ),

    new Command<{comptroller: Comptroller, cToken: CToken, action: StringV, isPaused: BoolV}>(`
        #### SetGuardianMarketPaused

        * "Comptroller SetGuardianMarketPaused <CToken> <Action> <Bool>" - Pauses or unpaused given cToken function
        * E.g. "Comptroller SetGuardianMarketPaused cREP "Mint" True"
        `,
        "SetGuardianMarketPaused",
        [
          new Arg("comptroller", getComptroller, {implicit: true}),
          new Arg("cToken", getCTokenV),
          new Arg("action", getStringV),
          new Arg("isPaused", getBoolV)
        ],
        (world, from, {comptroller, cToken, action, isPaused}) => setGuardianMarketPaused(world, from, comptroller, cToken, action.val, isPaused.val)
    ),

    new Command<{comptroller: Comptroller, blocks: NumberV, _keyword: StringV}>(`
        #### FastForward

        * "FastForward n:<Number> Blocks" - Moves the block number forward "n" blocks. Note: in "CTokenScenario" and "ComptrollerScenario" the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
          * E.g. "Comptroller FastForward 5 Blocks" - Move block number forward 5 blocks.
      `,
      "FastForward",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("blocks", getNumberV),
        new Arg("_keyword", getStringV)
      ],
      (world, from, {comptroller, blocks}) => fastForward(world, from, comptroller, blocks)
    ),
    new View<{comptroller: Comptroller}>(`
        #### Liquidity

        * "Comptroller Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, {comptroller}) => printLiquidity(world, comptroller)
    ),
    new View<{comptroller: Comptroller, input: StringV}>(`
        #### Decode

        * "Decode input:<String>" - Prints information about a call to a Comptroller contract
      `,
      "Decode",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("input", getStringV)

      ],
      (world, {comptroller, input}) => decodeCall(world, comptroller, input.val)
    ),
    new Command<{comptroller: Comptroller, cTokens: CToken[], supplyCaps: NumberV[]}>(`
      #### SetMarketSupplyCaps

      * "Comptroller SetMarketSupplyCaps (<CToken> ...) (<supplyCap> ...)" - Sets Market Supply Caps
      * E.g. "Comptroller SetMarketSupplyCaps (cZRX cUSDC) (10000.0e18, 1000.0e6)
      `,
        "SetMarketSupplyCaps",
        [
          new Arg("comptroller", getComptroller, {implicit: true}),
          new Arg("cTokens", getCTokenV, {mapped: true}),
          new Arg("supplyCaps", getNumberV, {mapped: true})
        ],
        (world, from, {comptroller, cTokens, supplyCaps}) => setMarketSupplyCaps(world, from, comptroller, cTokens, supplyCaps)
    ),
    new Command<{comptroller: Comptroller, cTokens: CToken[], borrowCaps: NumberV[]}>(`
      #### SetMarketBorrowCaps

      * "Comptroller SetMarketBorrowCaps (<CToken> ...) (<borrowCap> ...)" - Sets Market Borrow Caps
      * E.g "Comptroller SetMarketBorrowCaps (cZRX cUSDC) (10000.0e18, 1000.0e6)
      `,
      "SetMarketBorrowCaps",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cTokens", getCTokenV, {mapped: true}),
        new Arg("borrowCaps", getNumberV, {mapped: true})
      ],
      (world, from, {comptroller, cTokens, borrowCaps}) => setMarketBorrowCaps(world, from, comptroller, cTokens, borrowCaps)
    ),
    new Command<{comptroller: Comptroller, blockNumber: NumberV}>(`
        #### SetBlockNumber

        * "Comptroller SetBlockNumber <BlockNumber>" - Sets the blockNumber of the Comptroller
        * E.g. "Comptroller SetBlockNumber 500"
      `,
      'SetBlockNumber',
      [
        new Arg('comptroller', getComptroller, {implicit: true}),
        new Arg('blockNumber', getNumberV)
      ],
      (world, from, {comptroller, blockNumber}) => setBlockNumber(world, from, comptroller, blockNumber)
    ),
    new Command<{comptroller: Comptroller, protocol: AddressV, market: AddressV, creditLimit: NumberV}>(`
        #### SetCreditLimit
        * "Comptroller SetCreditLimit <Protocol> <Market> <CreditLimit>" - Sets the market credit limit of a protocol
        * E.g. "Comptroller SetCreditLimit Geoff cZRX 100"
      `,
      'SetCreditLimit',
      [
        new Arg('comptroller', getComptroller, {implicit: true}),
        new Arg('protocol', getAddressV),
        new Arg('market', getAddressV),
        new Arg('creditLimit', getNumberV)
      ],
      (world, from, {comptroller, protocol, market, creditLimit}) => setCreditLimit(world, from, comptroller, protocol.val, market.val, creditLimit)
    ),
  ];
}

export async function processComptrollerEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Comptroller", comptrollerCommands(), world, event, from);
}
