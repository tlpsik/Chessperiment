// Run with:  npx tsx src/engine/logic/randomValue.test.ts   (from the client folder)
import { BoardClass } from '../board';
import { Piece, CustomPiece } from '../piece';
import { LogicRunner, randomIntInclusive } from './LogicRunner';
import type { Square } from '../types';

let failed = 0;
function test(label: string, actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        console.log(`PASS ${label}`);
    } else {
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

const variable = (name: string, variableOnly = false) => ({ type: 'variable', name, variableOnly });

function run(logic: any[], position: Square = 'e4', variables: Record<string, any> = {}) {
    const board = new BoardClass({}, undefined, 8, 8);
    const piece = Piece.create('p', 'dragon', 'white', position, [], logic, 'dragon') as CustomPiece;
    Object.assign(piece.variables, variables);
    board.setPiece(position, piece);
    piece.executeLogic('on-move', {}, board);
    return piece;
}

function assign(value: any, thenId?: string) {
    return [
        { id: 'on-move', type: 'trigger', instanceId: 't', socketValues: {}, childId: 'm', checkFrequency: 'every-move' },
        {
            id: 'modify-var', type: 'effect', instanceId: 'm', childId: thenId ?? null,
            socketValues: {
                varName: variable('roll', true),
                op: '=',
                value
            }
        }
    ];
}

// --- pure range -------------------------------------------------------------
{
    const rolls = Array.from({ length: 40 }, () => randomIntInclusive(1, 1));
    test('a one-number range always returns that number', rolls.every(n => n === 1), true);
}
{
    const rolls = Array.from({ length: 200 }, () => randomIntInclusive(1, 6));
    assert('rolls stay inside 1 to 6', rolls.every(n => Number.isInteger(n) && n >= 1 && n <= 6));
    assert('a wide range actually varies', new Set(rolls).size > 1);
}
{
    const rolls = Array.from({ length: 80 }, () => randomIntInclusive(6, 1));
    assert('ends are swapped when the first is greater', rolls.every(n => n >= 1 && n <= 6));
}
{
    const rolls = Array.from({ length: 40 }, () => randomIntInclusive('nope', undefined));
    assert('non-numeric ends fall back to 1 through 10', rolls.every(n => n >= 1 && n <= 10));
}
{
    test('negative ends stay inclusive', randomIntInclusive(-2, -2), -2);
}

// --- logic runner -----------------------------------------------------------
{
    const piece = run(assign({ type: 'random', from: 4, to: 4 }));
    test('modify-var stores a fixed random roll', piece.variables.roll, 4);
}
{
    const piece = run(assign({
        type: 'random',
        from: variable('x'),
        to: variable('x')
    }), 'e4');
    // e4 is file 4 (a=0), so x is 4.
    test('pick random can read the x variable', piece.variables.roll, 4);
}
{
    const piece = run(assign({
        type: 'random',
        from: variable('low'),
        to: variable('high')
    }), 'e4', { low: 2, high: 2 });
    test('pick random can read custom variables', piece.variables.roll, 2);
}
{
    const piece = run(assign({
        type: 'random',
        from: { type: 'random', from: 8, to: 8 },
        to: { type: 'random', from: 8, to: 8 }
    }));
    test('pick random can nest inside itself', piece.variables.roll, 8);
}
{
    const rolls = Array.from({ length: 60 }, () => run(assign({ type: 'random', from: 1, to: 3 })).variables.roll);
    assert('a random socket varies across moves and stays in range', rolls.every(n => n >= 1 && n <= 3) && new Set(rolls).size > 1);
}
{
    const logic = [
        ...assign({ type: 'random', from: 5, to: 5 }, 'iff'),
        {
            id: 'if', type: 'effect', instanceId: 'iff', childId: null,
            socketValues: { left: variable('roll'), op: '==', right: { type: 'random', from: 5, to: 5 } },
            thenChildId: 'yes', elseChildId: 'no'
        },
        {
            id: 'modify-var', type: 'effect', instanceId: 'yes', childId: null,
            socketValues: { varName: variable('flag', true), op: '=', value: 1 }
        },
        {
            id: 'modify-var', type: 'effect', instanceId: 'no', childId: null,
            socketValues: { varName: variable('flag', true), op: '=', value: 0 }
        }
    ];
    const piece = run(logic);
    test('an if can compare a variable with pick random', piece.variables.flag, 1);
}
{
    const logic = [
        { id: 'on-move', type: 'trigger', instanceId: 't', socketValues: {}, childId: 'c', checkFrequency: 'every-move' },
        {
            id: 'cooldown', type: 'effect', instanceId: 'c', childId: null,
            socketValues: { duration: { type: 'random', from: 3, to: 3 }, unit: 'half-moves' }
        }
    ];
    const piece = run(logic);
    test('cooldown accepts pick random as its duration', piece.variables.cooldown, 3);
}
{
    const cycle: any = { type: 'random', from: 1, to: 1 };
    cycle.from = cycle;
    const piece = run(assign(cycle));
    assert('a cyclic random expression does not recurse forever', piece.variables.roll === 0 || piece.variables.roll === 1);
}

// The static executor must be idle for the next file that imports it.
assert('runner finished idle', (LogicRunner as any).isExecuting === false);

// --- blockly round trip -----------------------------------------------------
async function testBlocklyRoundTrip() {
    const Blockly = await import('blockly');
    await import('blockly/blocks');
    const defs = await import('../../app/[locale]/editor/[projectId]/piece-editor/[id]/logic/blocklyDefinitions');

    const proto = Blockly.Block.prototype as any;
    if (!proto.initSvg) proto.initSvg = function () { return this; };
    if (!proto.render) proto.render = function () { return this; };

    const ws = new Blockly.Workspace();
    const block = ws.newBlock('modify-var') as any;
    defs.writeBlockSocketValue(block, 'value', { type: 'random', from: 3, to: 9 });
    defs.writeBlockSocketValue(block, 'varName', { type: 'variable', name: 'roll', variableOnly: true });

    const values = defs.readBlockSocketValues(block);
    test('a plugged-in pick random block serializes as a value', values, {
        varName: { type: 'variable', name: 'roll', variableOnly: true },
        op: '+=',
        value: { type: 'random', from: 3, to: 9 }
    });

    const fresh = ws.newBlock(defs.PICK_RANDOM_BLOCK) as any;
    const open = ws.newBlock('modify-var') as any;
    const reason = ws.connectionChecker.canConnectWithReason(
        fresh.outputConnection,
        open.getInput('value')?.connection ?? null,
        false
    );
    assert('pick random can plug into a number socket', reason === Blockly.Connection.CAN_CONNECT);

    open.getInput('value').connection.connect(fresh.outputConnection);
    test('a new pick random block defaults to 1 and 10', defs.readBlockSocketValues(open).value, {
        type: 'random', from: 1, to: 10
    });
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
