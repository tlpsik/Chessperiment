import * as Blockly from 'blockly';

// Shared constants to match PageClient.tsx
export const BLOCK_HEIGHT = 48;
export const DEFAULT_WIDTH = 220;
export const VARIABLE_WIDTH = 160;
export const CONNECTOR_X = 24;
export const CONNECTOR_Y = BLOCK_HEIGHT + 4;

// Same reporter as the piece editor. It is not a statement: it plugs into a number
// socket and is saved inside that socket, not as its own logic entry.
export const PICK_RANDOM_BLOCK = 'pick-random';
export const PICK_RANDOM_COLOUR = '#59C059';

const REPORTER_BLOCK_TYPES = new Set([PICK_RANDOM_BLOCK, 'text', 'math_number']);

const VALUE_SOCKETS: Record<string, { id: string, shadow: 'text' | 'math_number', fallback: string }[]> = {
    'on-proximity': [{ id: 'distance', shadow: 'math_number', fallback: '1' }],
    'modify-var': [{ id: 'value', shadow: 'text', fallback: '0' }],
    'if': [
        { id: 'left', shadow: 'text', fallback: 'myVar' },
        { id: 'right', shadow: 'text', fallback: '0' }
    ]
};

/**
 * Defines the custom block types for the Logic Editor.
 */
export const defineCustomBlocks = () => {
    // Triggers (Yellow)
    Blockly.Blocks['on-step'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("onStep")
                .appendField(new Blockly.FieldDropdown([["Any", "Any"], ["Pawn", "Pawn"], ["Knight", "Knight"], ["Bishop", "Bishop"], ["Rook", "Rook"], ["Queen", "Queen"], ["King", "King"]]), "pieceType")
                .appendField("Color")
                .appendField(new Blockly.FieldDropdown([["Any", "Any"], ["White", "White"], ["Black", "Black"]]), "pieceColor");
            this.setNextStatement(true, "Effect");
            this.setStyle('trigger_blocks'); // Use style for black text
            this.setTooltip("Fires when a piece lands on this square.");
        }
    };

    Blockly.Blocks['on-proximity'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("onProximity");
            this.appendValueInput("distance").setCheck(null);
            this.setInputsInline(true);
            this.setNextStatement(true, "Effect");
            this.setStyle('trigger_blocks'); // Use style for black text
            this.setTooltip("Fires when a piece is near this square. The distance can be a number or pick random.");
        }
    };

    // Effects (Blue)
    Blockly.Blocks['teleport'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("teleport to")
                .appendField(new Blockly.FieldTextInput("a1"), "targetSquare");
            this.setPreviousStatement(true, "Effect");
            this.setNextStatement(true, "Effect");
            this.setColour("#4169E1");
            this.setTooltip("Teleport the piece to another square.");
        }
    };

    Blockly.Blocks['disable-square'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("disableSquare");
            this.setPreviousStatement(true, "Effect");
            this.setNextStatement(true, "Effect");
            this.setColour("#FF4500");
            this.setTooltip("Make this square inactive.");
        }
    };

    Blockly.Blocks['enable-square'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("enableSquare");
            this.setPreviousStatement(true, "Effect");
            this.setNextStatement(true, "Effect");
            this.setColour("#32CD32");
            this.setTooltip("Make this square active.");
        }
    };

    // Terminals (Purple)
    Blockly.Blocks['kill'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("kill");
            this.setPreviousStatement(true, "Effect");
            this.setColour("#9370DB");
            this.setTooltip("Remove the piece from the board.");
        }
    };

    Blockly.Blocks['win'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("win")
                .appendField(new Blockly.FieldDropdown([["Trigger Side", "Trigger Side"], ["White", "White"], ["Black", "Black"]]), "side");
            this.setPreviousStatement(true, "Effect");
            this.setColour("#9370DB");
            this.setTooltip("Declare a win for a specific side.");
        }
    };

    // Modify a square variable (+=, -=, =). No block existed for this yet even though
    // SquareLogicRunner already supports it; added here alongside 'if' so comparisons have
    // something to read/write against.
    Blockly.Blocks['modify-var'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("var")
                .appendField(new Blockly.FieldTextInput("myVar"), "varName")
                .appendField(new Blockly.FieldDropdown([["+=", "+="], ["-=", "-="], ["=", "="]]), "op");
            this.appendValueInput("value").setCheck(null);
            this.setInputsInline(true);
            this.setPreviousStatement(true, "Effect");
            this.setNextStatement(true, "Effect");
            this.setColour("#4169E1");
            this.setTooltip("Change a square variable's value. The value can be text, a number, or pick random.");
        }
    };

    // Conditional branch. 'left'/'right' are each either a literal, or the name of an
    // existing square variable (resolved by SquareLogicRunner at run time). Has its own
    // previous/next connection (continues the main chain after the if/else), plus two
    // statement inputs for the THEN/ELSE branch bodies.
    Blockly.Blocks['if'] = {
        init: function() {
            this.appendValueInput("left").setCheck(null).appendField("if");
            this.appendValueInput("right").setCheck(null)
                .appendField(new Blockly.FieldDropdown([["==", "=="], ["!=", "!="], [">", ">"], ["<", "<"], [">=", ">="], ["<=", "<="]]), "op");
            this.appendStatementInput("THEN").setCheck("Effect").appendField("then");
            this.appendStatementInput("ELSE").setCheck("Effect").appendField("else");
            this.setInputsInline(true);
            this.setPreviousStatement(true, "Effect");
            this.setNextStatement(true, "Effect");
            this.setColour("#8B5CF6");
            this.setTooltip("Compares two values. Each side can be text, a variable name, a number, or pick random.");
        }
    };

    // Reporter. Number fields (not nested sockets) keep it one row high, so it sits in a
    // value socket the same way a variable does instead of covering the block it plugs into.
    Blockly.Blocks[PICK_RANDOM_BLOCK] = {
        init: function() {
            this.appendDummyInput()
                .appendField("pick random")
                .appendField(new Blockly.FieldNumber(1, -1e9, 1e9, 1), "FROM")
                .appendField("to")
                .appendField(new Blockly.FieldNumber(10, -1e9, 1e9, 1), "TO");
            this.setOutput(true, null);
            this.setStyle('random_blocks');
            this.setTooltip("Picks a random whole number from the first value to the second, including both ends. Plug it into any number socket, the same way you plug in a variable.");
        }
    };
};

export function isSquareReporter(type: string): boolean {
    return REPORTER_BLOCK_TYPES.has(type);
}

function readSquareReporter(target: Blockly.Block | null): any {
    if (!target) return undefined;
    if (target.type === PICK_RANDOM_BLOCK) {
        const from = Number(target.getFieldValue('FROM'));
        const to = Number(target.getFieldValue('TO'));
        return {
            type: 'random',
            from: Number.isFinite(from) ? from : 1,
            to: Number.isFinite(to) ? to : 10
        };
    }
    if (target.type === 'math_number') {
        const raw = target.getFieldValue('NUM');
        return raw === '' || raw === null ? undefined : Number(raw);
    }
    if (target.type === 'text') {
        return target.getFieldValue('TEXT');
    }
    return undefined;
}

/** Fields on the block, plus anything plugged into a value socket (a literal or pick random). */
export function readSquareSocketValues(block: Blockly.Block): Record<string, any> {
    const result: Record<string, any> = {};
    block.inputList.forEach(input => {
        input.fieldRow.forEach(field => {
            if (field.name) result[field.name] = field.getValue();
        });
        if (input.name && input.connection) {
            const value = readSquareReporter(input.connection.targetBlock());
            if (value !== undefined) result[input.name] = value;
        }
    });
    return result;
}

function connectShadow(block: Blockly.BlockSvg, inputName: string, shadowType: 'text' | 'math_number', fallback: string) {
    const connection = block.getInput(inputName)?.connection;
    if (!connection || connection.targetBlock()) return;
    const shadow = block.workspace.newBlock(shadowType) as Blockly.BlockSvg;
    shadow.setShadow(true);
    shadow.setFieldValue(fallback, shadowType === 'math_number' ? 'NUM' : 'TEXT');
    shadow.initSvg();
    shadow.render();
    connection.connect(shadow.outputConnection!);
}

/** Default literal shadows for a newly spawned block's value sockets. */
export function initializeSquareValueSockets(block: Blockly.BlockSvg) {
    const sockets = VALUE_SOCKETS[block.type];
    if (!sockets) return;
    sockets.forEach(socket => connectShadow(block, socket.id, socket.shadow, socket.fallback));
}

/** Writes a socket, attaching pick random when the value is a random expression. */
export function writeSquareSocketValue(block: Blockly.BlockSvg, key: string, value: any) {
    const input = block.getInput(key);
    if (input?.connection && (value && typeof value === 'object' || !block.getField(key))) {
        const existing = input.connection.targetBlock();
        if (existing) existing.dispose(true);
        if (value && typeof value === 'object' && value.type === 'random') {
            const randomBlock = block.workspace.newBlock(PICK_RANDOM_BLOCK) as Blockly.BlockSvg;
            const from = Number(value.from);
            const to = Number(value.to);
            randomBlock.setFieldValue(String(Number.isFinite(from) ? from : 1), 'FROM');
            randomBlock.setFieldValue(String(Number.isFinite(to) ? to : 10), 'TO');
            randomBlock.initSvg();
            randomBlock.render();
            input.connection.connect(randomBlock.outputConnection!);
            return;
        }
        const shadowType = key === 'distance' ? 'math_number' : 'text';
        connectShadow(block, key, shadowType, String(value ?? ''));
        return;
    }
    const field = block.getField(key);
    if (field) field.setValue(value as string);
}

interface XmlNode {
    tag: string;
    attrs: Record<string, string>;
    children: Array<XmlNode | string>;
}

function decodeXml(text: string): string {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

function encodeXml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Blockly XML is a small subset. Parsing it here keeps server render and the browser in agreement. */
function parseXml(source: string): XmlNode | null {
    const s = source.trim();
    let i = s.startsWith('<?') ? s.indexOf('?>') + 2 : 0;
    if (i < 2 && s.startsWith('<?')) return null;

    const skipWs = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    const parseNode = (): XmlNode | string | null => {
        skipWs();
        if (i >= s.length) return null;
        if (s[i] !== '<') {
            const start = i;
            while (i < s.length && s[i] !== '<') i++;
            return decodeXml(s.slice(start, i));
        }
        if (s.startsWith('<!--', i)) {
            const end = s.indexOf('-->', i);
            if (end < 0) return null;
            i = end + 3;
            return parseNode();
        }
        if (s.startsWith('</', i)) return null;
        i++;
        const name = /^[A-Za-z0-9_:-]+/.exec(s.slice(i));
        if (!name) return null;
        i += name[0].length;
        const attrs: Record<string, string> = {};
        while (i < s.length) {
            skipWs();
            if (s[i] === '>' || s[i] === '/') break;
            const attr = /^[A-Za-z0-9_:-]+/.exec(s.slice(i));
            if (!attr) return null;
            i += attr[0].length;
            skipWs();
            if (s[i] !== '=') return null;
            i++;
            skipWs();
            const quote = s[i];
            if (quote !== '"' && quote !== "'") return null;
            const end = s.indexOf(quote, i + 1);
            if (end < 0) return null;
            attrs[attr[0]] = decodeXml(s.slice(i + 1, end));
            i = end + 1;
        }
        skipWs();
        const selfClosing = s[i] === '/';
        if (selfClosing) i++;
        if (s[i] !== '>') return null;
        i++;
        const node: XmlNode = { tag: name[0], attrs, children: [] };
        if (selfClosing) return node;
        while (i < s.length && !s.startsWith('</', i)) {
            const child = parseNode();
            if (child === null) return null;
            if (typeof child === 'string') {
                if (child.trim() !== '') node.children.push(child);
            } else {
                node.children.push(child);
            }
        }
        if (!s.startsWith('</' + name[0], i)) return null;
        i += 2 + name[0].length;
        const close = s.indexOf('>', i);
        if (close < 0) return null;
        i = close + 1;
        return node;
    };

    skipWs();
    const root = parseNode();
    return root && typeof root !== 'string' ? root : null;
}

function serializeXml(node: XmlNode): string {
    const attrs = Object.entries(node.attrs)
        .map(([key, value]) => ` ${key}="${encodeXml(value).replace(/"/g, '&quot;')}"`)
        .join('');
    const inner = node.children
        .map(child => typeof child === 'string' ? encodeXml(child) : serializeXml(child))
        .join('');
    return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

/**
 * Older square workspaces stored distance / value / left / right as fields on the
 * statement block. Those are value sockets now, so lift the old field text into a shadow.
 */
export function migrateSquareLogicXml(xml: string): string {
    if (!xml) return xml;
    const root = parseXml(xml);
    if (!root) return xml;

    let changed = false;
    const visit = (node: XmlNode) => {
        if (node.tag === 'block' || node.tag === 'shadow') {
            const specs = VALUE_SOCKETS[node.attrs.type || ''];
            specs?.forEach(spec => {
                const already = node.children.some(child =>
                    typeof child !== 'string' && child.tag === 'value' && child.attrs.name === spec.id
                );
                if (already) return;
                const fieldIndex = node.children.findIndex(child =>
                    typeof child !== 'string' && child.tag === 'field' && child.attrs.name === spec.id
                );
                let text = spec.fallback;
                if (fieldIndex >= 0) {
                    const field = node.children[fieldIndex] as XmlNode;
                    const fieldText = field.children.filter((child): child is string => typeof child === 'string').join('');
                    text = fieldText || spec.fallback;
                    node.children.splice(fieldIndex, 1);
                }
                node.children.push({
                    tag: 'value',
                    attrs: { name: spec.id },
                    children: [{
                        tag: 'shadow',
                        attrs: { type: spec.shadow },
                        children: [{
                            tag: 'field',
                            attrs: { name: spec.shadow === 'math_number' ? 'NUM' : 'TEXT' },
                            children: [text]
                        }]
                    }]
                });
                changed = true;
            });
        }
        node.children.forEach(child => {
            if (typeof child !== 'string') visit(child);
        });
    };
    visit(root);
    return changed ? serializeXml(root) : xml;
}

/**
 * Custom Constant Provider to define LEGO-style shapes with pill-like roundness.
 */
class CustomConstantProvider extends Blockly.blockRendering.ConstantProvider {
    constructor() {
        super();
        this.NOTCH_WIDTH = 12;
        this.NOTCH_HEIGHT = 4;
        this.CORNER_RADIUS = 12; // Softer, more modern corners
        this.TAB_WIDTH = 12;
        this.TAB_HEIGHT = 4;
        
        // Tightened padding to fix "too tall" blocks
        this.EMPTY_BLOCK_SPACER_HEIGHT = 8;
        this.TOP_ROW_MIN_HEIGHT = 18; 
        this.BOTTOM_ROW_MIN_HEIGHT = 4;
        this.NOTCH_OFFSET_LEFT = 24;
        
        // Ensure text and fields are centered
        this.FIELD_TEXT_BASELINE_CENTER = true;
    }

    // Override to ensure all corners are rounded, fixing the "cut off" right side
    protected override makeOutsideCorners(): any {
        const radius = this.CORNER_RADIUS;
        return {
            topLeft: `a ${radius},${radius} 0 0,1 ${radius},-${radius}`,
            topRight: `a ${radius},${radius} 0 0,1 ${radius},${radius}`,
            bottomRight: `a ${radius},${radius} 0 0,1 -${radius},${radius}`,
            bottomLeft: `a ${radius},${radius} 0 0,1 -${radius},-${radius}`
        };
    }

    protected override makeNotch(): any {
        const width = this.NOTCH_WIDTH;
        const height = this.NOTCH_HEIGHT;
        return {
            type: 1,
            width: width,
            height: height,
            pathLeft: `l 3,${height} ${width - 6},0 3,-${height}`,
            pathRight: `l -3,${height} -${width - 6},0 -3,-${height}`
        };
    }

    protected override makePuzzleTab(): any {
        const width = this.TAB_WIDTH;
        const height = this.TAB_HEIGHT;
        return {
            type: 2,
            width: width,
            height: height,
            pathLeft: `l 0,3 ${width},0 0,-3`,
            pathRight: `l 0,3 -${width},0 0,-3`,
            pathDown: `l 3,0 ${width - 6},${height} 3,-${height}`,
            pathUp: `l 3,0 ${width - 6},-${height} 3,${height}`
        };
    }
}

/**
 * Custom Renderer.
 */
export class CustomRenderer extends Blockly.blockRendering.Renderer {
    protected override makeConstants_(): Blockly.blockRendering.ConstantProvider {
        return new CustomConstantProvider();
    }
}

// Run registration immediately
defineCustomBlocks();

// Register items
if (typeof window !== 'undefined') {
    // Register Renderer
    if (!Blockly.registry.hasItem(Blockly.registry.Type.RENDERER, 'custom_renderer')) {
        Blockly.registry.register(Blockly.registry.Type.RENDERER, 'custom_renderer', CustomRenderer);
    }

    // Register a proper Dark Theme to avoid registry errors
    const DarkTheme = Blockly.Theme.defineTheme('custom_dark', {
        'name': 'custom_dark',
        'base': Blockly.Themes.Classic,
        'blockStyles': {
            'trigger_blocks': {
                'colourPrimary': '#FFD700',
                'colourSecondary': '#FFEC8B',
                'colourTertiary': '#CDBE70'
            },
            'random_blocks': {
                'colourPrimary': '#59C059',
                'colourSecondary': '#46A046',
                'colourTertiary': '#388C38'
            }
        },
        'componentStyles': {
            'workspaceBackgroundColour': '#0c0e12',
            'toolboxBackgroundColour': '#1a1d23',
            'flyoutBackgroundColour': '#1a1d23',
            'scrollbarColour': '#ffffff10',
            'scrollbarOpacity': 0.1,
        }
    });

    if (!Blockly.registry.hasItem(Blockly.registry.Type.THEME, 'custom_dark')) {
        Blockly.registry.register(Blockly.registry.Type.THEME, 'custom_dark', DarkTheme);
    }
}
