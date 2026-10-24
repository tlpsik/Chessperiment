// Run with:  node engine/logic/squareRandomValue.test.js   (from the server folder)
import { BoardClass } from '../board.js';
import { Piece } from '../piece.js';
import { SquareLogicRunner } from './SquareLogicRunner.js';

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

function run(logic, variables = {}, squareId = 'e4', piecePos = 'e4', trigger = 'on-step') {
    const squareLogic = { logic, variables: { ...variables }, squareId };
    const board = new BoardClass({}, undefined, 8, 8, 'square', { [squareId]: squareLogic });
    const piece = Piece.create('p', 'pawn', 'white', piecePos);
    board.setPiece(piecePos, piece);
    SquareLogicRunner.execute(squareId, trigger, { piece }, board);
    return squareLogic.variables;
}

const step = (childId) => ({
    id: 'on-step', type: 'trigger', instanceId: 't', childId, socketValues: {}
});
const setVar = (instanceId, name, value, op = '=') => ({
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
}

assert('runner finished idle', SquareLogicRunner.isExecuting === false);

if (failed > 0) {
    console.log(`\n${failed} failed`);
    process.exit(1);
}
console.log('\nall passed');
