// Run with:  node engine/logic/randomValue.test.js   (from the server folder)
import { BoardClass } from '../board.js';
import { Piece } from '../piece.js';
import { LogicRunner, randomIntInclusive } from './LogicRunner.js';

let failed = 0;
function test(label, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) console.log(`PASS ${label}`);
    else {
        failed++;
        console.log(`FAIL ${label}\n     expected: ${e}\n     actual:   ${a}`);
    }
}
function assert(label, ok) {
    if (ok) console.log(`PASS ${label}`);
    else {
        failed++;
        console.log(`FAIL ${label}`);
    }
}

const variable = (name, variableOnly = false) => ({ type: 'variable', name, variableOnly });

function run(logic, position = 'e4', variables = {}) {
    const board = new BoardClass({}, undefined, 8, 8);
    const piece = Piece.create('p', 'dragon', 'white', position, [], logic, 'dragon');
    Object.assign(piece.variables, variables);
    board.setPiece(position, piece);
    piece.executeLogic('on-move', {}, board);
    return piece;
}

function assign(value) {
    return [
        { id: 'on-move', type: 'trigger', instanceId: 't', socketValues: {}, childId: 'm', checkFrequency: 'every-move' },
        {
            id: 'modify-var', type: 'effect', instanceId: 'm', childId: null,
            socketValues: { varName: variable('roll', true), op: '=', value }
        }
    ];
}

{
    const rolls = Array.from({ length: 200 }, () => randomIntInclusive(1, 6));
    assert('rolls stay inside 1 to 6', rolls.every(n => Number.isInteger(n) && n >= 1 && n <= 6));
    assert('a wide range actually varies', new Set(rolls).size > 1);
}
{
    test('a fixed roll is stored', run(assign({ type: 'random', from: 4, to: 4 })).variables.roll, 4);
}
{
    test('x is the file of the piece', run(assign({ type: 'random', from: variable('x'), to: variable('x') })).variables.roll, 4);
}
{
    test('custom variables can be the ends', run(assign({
        type: 'random',
        from: variable('low'),
        to: variable('high')
    }), 'e4', { low: 2, high: 2 }).variables.roll, 2);
}
{
    const cycle = { type: 'random', from: 1, to: 1 };
    cycle.from = cycle;
    const roll = run(assign(cycle)).variables.roll;
    assert('a cyclic random expression does not recurse forever', roll === 0 || roll === 1);
}
assert('runner finished idle', LogicRunner.isExecuting === false);

if (failed > 0) {
    console.log(`\n${failed} failed`);
    process.exit(1);
}
console.log('\nall passed');
