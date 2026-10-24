// Run with:  npx tsx src/engine/logic/squareRandomValue.test.ts   (from the client folder)
import { BoardClass } from '../board';
import { Piece } from '../piece';
import { SquareLogicRunner, type SquareLogic } from './SquareLogicRunner';
import type { Square } from '../types';

let failed = 0;
function test(label: string, actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) console.log(`PASS ${label}`);
    else {
        failed++;
        console.log(`FAIL ${label}\n     expected: ${e}\n     actual:   ${a}`);
    }
}
function assert(label: string, ok: boolean) {
    if (ok) console.log(`PASS ${label}`);
    else {
        failed++;
        console.log(`FAIL ${label}`);
    }
}

function run(logic: any[], variables: Record<string, any> = {}, squareId: Square = 'e4', piecePos: Square = 'e4', trigger = 'on-step') {
    const squareLogic: SquareLogic = { logic, variables: { ...variables }, squareId };
    const board = new BoardClass({}, undefined, 8, 8, 'square', { [squareId]: squareLogic });
    const piece = Piece.create('p', 'pawn', 'white', piecePos);
    board.setPiece(piecePos, piece);
    SquareLogicRunner.execute(squareId, trigger, { piece }, board);
    return squareLogic.variables;
}

const step = (childId: string, extra: any = {}) => ({
    id: 'on-step', type: 'trigger', instanceId: 't', childId, socketValues: {}, ...extra
});

const setVar = (instanceId: string, name: any, value: any, op = '=') => ({
    id: 'modify-var', type: 'effect', instanceId, childId: null,
    socketValues: { varName: name, op, value }
});

{
    const variables = run([
        step('m'),
        setVar('m', 'roll', { type: 'random', from: 4, to: 4 })
    ]);
    test('modify-var stores a fixed random roll', variables.roll, 4);
}
{
    const variables = run([
        step('m'),
        setVar('m', 'roll', { type: 'random', from: { type: 'random', from: 2, to: 2 }, to: { type: 'random', from: 2, to: 2 } })
    ]);
    test('nested random ends are rolled before the outer range', variables.roll, 2);
}
{
    const cycle: any = { type: 'random', from: 1, to: 1 };
    cycle.from = cycle;
    const variables = run([step('m'), setVar('m', 'roll', cycle)]);
    assert('a cyclic random expression does not recurse forever', variables.roll === 0 || variables.roll === 1);
}
{
    const variables = run([
        step('m'),
        setVar('m', { type: 'variable', name: 'roll', variableOnly: true }, { type: 'variable', name: 'src' })
    ], { src: 9 });
    test('a variable object in the value socket reads the square variable', variables.roll, 9);
}
{
    const variables = run([
        step('iff'),
        {
            id: 'if', type: 'effect', instanceId: 'iff', childId: null,
            thenChildId: 'yes', elseChildId: 'no',
            socketValues: { left: { type: 'random', from: 5, to: 5 }, op: '==', right: '5' }
        },
        setVar('yes', 'flag', 'then'),
        setVar('no', 'flag', 'else')
    ]);
    test('if compares a fixed roll and takes the then branch', variables.flag, 'then');
}
{
    const variables = run([
        step('iff'),
        {
            id: 'if', type: 'effect', instanceId: 'iff', childId: null,
            thenChildId: 'yes', elseChildId: 'no',
            socketValues: { left: 'myVar', op: '==', right: '7' }
        },
        setVar('yes', 'flag', 'then'),
        setVar('no', 'flag', 'else')
    ], { myVar: 7 });
    test('a plain string is still a variable name', variables.flag, 'then');
}
{
    const near = run([
        {
            id: 'on-proximity', type: 'trigger', instanceId: 't', childId: 'm',
            socketValues: { distance: { type: 'random', from: 1, to: 1 } }
        },
        setVar('m', 'flag', 'near')
    ], {}, 'e4', 'e4', 'on-proximity');
    test('on-proximity distance can be a random roll', near.flag, 'near');

    const far = run([
        {
            id: 'on-proximity', type: 'trigger', instanceId: 't', childId: 'm',
            socketValues: { distance: { type: 'random', from: 1, to: 1 } }
        },
        setVar('m', 'flag', 'near')
    ], {}, 'e4', 'a1', 'on-proximity');
    test('a roll of 1 does not reach a far piece', far.flag, undefined);

    const legacy = run([
        {
            id: 'on-proximity', type: 'trigger', instanceId: 't', childId: 'm',
            socketValues: { distance: '2' }
        },
        setVar('m', 'flag', 'near')
    ], {}, 'e4', 'c3', 'on-proximity');
    test('an old text distance still works', legacy.flag, 'near');
}

assert('runner finished idle', (SquareLogicRunner as any).isExecuting === false);

async function testBlocklyRoundTrip() {
    const Blockly = await import('blockly');
    await import('blockly/blocks');
    const defs = await import('../../app/[locale]/editor/[projectId]/square-editor/blocklyDefinitions');

    const proto = Blockly.Block.prototype as any;
    if (!proto.initSvg) proto.initSvg = function () { return this; };
    if (!proto.render) proto.render = function () { return this; };

    const ws = new Blockly.Workspace();
    const block = ws.newBlock('modify-var') as any;
    defs.writeSquareSocketValue(block, 'value', { type: 'random', from: 3, to: 9 });
    defs.writeSquareSocketValue(block, 'varName', 'score');
    defs.writeSquareSocketValue(block, 'op', '=');

    test('a plugged-in pick random block serializes as a value', defs.readSquareSocketValues(block), {
        varName: 'score',
        op: '=',
        value: { type: 'random', from: 3, to: 9 }
    });

    const fresh = ws.newBlock(defs.PICK_RANDOM_BLOCK) as any;
    const open = ws.newBlock('if') as any;
    const reason = ws.connectionChecker.canConnectWithReason(
        fresh.outputConnection,
        open.getInput('left')?.connection ?? null,
        false
    );
    assert('pick random can plug into an if socket', reason === Blockly.Connection.CAN_CONNECT);

    const distance = ws.newBlock('on-proximity') as any;
    defs.initializeSquareValueSockets(distance);
    test('a new on-proximity block shadows distance with 1', defs.readSquareSocketValues(distance).distance, 1);

    const migrated = defs.migrateSquareLogicXml(
        '<xml><block type="modify-var" id="m"><field name="varName">score</field><field name="op">=</field><field name="value">7</field></block><block type="on-proximity" id="p"><field name="distance">3</field></block><block type="if" id="i"><field name="left">myVar</field><field name="op">==</field><field name="right">0</field></block></xml>'
    );
    assert('old value fields become shadow blocks', migrated.includes('<value name="value">') && migrated.includes('>7<'));
    assert('old distance fields become number shadows', migrated.includes('type="math_number"') && migrated.includes('>3<'));
    assert('old if sides become text shadows', migrated.includes('<value name="left">') && migrated.includes('>myVar<'));
    assert('fields that are still real fields stay put', migrated.includes('<field name="varName">score</field>'));
    const again = defs.migrateSquareLogicXml(migrated);
    test('migration leaves an already converted workspace alone', again, migrated);
}

testBlocklyRoundTrip().then(() => {
    if (failed > 0) {
        console.log(`\n${failed} failed`);
        process.exit(1);
    }
    console.log('\nall passed');
}).catch(error => {
    console.error(error);
    process.exit(1);
});
