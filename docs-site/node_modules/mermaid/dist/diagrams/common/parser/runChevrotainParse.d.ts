import type { CstNode, CstParser, Lexer } from 'chevrotain';
interface ChevrotainParseConfig {
    diagramType: string;
    lexer: Lexer;
    parser: CstParser;
    entry: () => CstNode;
    visit: (cst: CstNode) => void;
}
/** Runs a singleton lexer/parser pair and visits the resulting CST. */
export declare function runChevrotainParse(config: ChevrotainParseConfig, input: string): void;
export {};
