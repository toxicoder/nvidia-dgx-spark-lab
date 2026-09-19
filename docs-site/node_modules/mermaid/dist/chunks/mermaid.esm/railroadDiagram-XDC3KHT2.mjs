import {
  db,
  getStyles,
  renderer
} from "./chunk-MH3WDIKF.mjs";
import {
  populateCommonDb
} from "./chunk-X67BZSRO.mjs";
import {
  MermaidParseError
} from "./chunk-PP7T2VXU.mjs";
import "./chunk-VJXJ5QCJ.mjs";
import "./chunk-3GRS7R6R.mjs";
import "./chunk-G2A2OEYH.mjs";
import "./chunk-MULULVMI.mjs";
import "./chunk-O5H7SEHM.mjs";
import "./chunk-6WE5GGNG.mjs";
import "./chunk-KD5VN4N6.mjs";
import {
  createRailroadServices
} from "./chunk-G6AM5BRH.mjs";
import "./chunk-J74O3ZRR.mjs";
import "./chunk-2JN552EF.mjs";
import "./chunk-Q77HCHBN.mjs";
import "./chunk-KIWDUUFH.mjs";
import "./chunk-JDESJKT4.mjs";
import "./chunk-ZEJ26CLT.mjs";
import "./chunk-YOWFEKIV.mjs";
import "./chunk-WLRJLAWP.mjs";
import "./chunk-VD2MO4BW.mjs";
import "./chunk-KMA2NSDO.mjs";
import {
  log
} from "./chunk-OHNBJXQ2.mjs";
import {
  __name
} from "./chunk-35ZOQMXA.mjs";

// src/diagrams/railroad/parser/railroadParser.ts
var langiumParser = createRailroadServices().Railroad.parser.LangiumParser;
var transformExpression = /* @__PURE__ */ __name((expr) => {
  switch (expr.$type) {
    case "RailroadTerminalExpr":
      return {
        type: "terminal",
        value: expr.value
      };
    case "RailroadNonTerminalExpr":
      return {
        type: "nonterminal",
        name: expr.name
      };
    case "RailroadSpecialExpr":
      return {
        type: "special",
        text: expr.text
      };
    case "RailroadSequenceExpr": {
      const elements = expr.elements.map(transformExpression);
      return elements.length === 1 ? elements[0] : { type: "sequence", elements };
    }
    case "RailroadChoiceExpr": {
      const alternatives = expr.alternatives.map(transformExpression);
      return alternatives.length === 1 ? alternatives[0] : { type: "choice", alternatives };
    }
    case "RailroadOptionalExpr":
      return {
        type: "optional",
        element: transformExpression(expr.element)
      };
    case "RailroadOneOrMoreExpr":
      return {
        type: "repetition",
        element: transformExpression(expr.element),
        min: 1,
        max: Infinity
      };
    case "RailroadZeroOrMoreExpr":
      return {
        type: "repetition",
        element: transformExpression(expr.element),
        min: 0,
        max: Infinity
      };
    default:
      throw new Error(`Unsupported railroad expression: ${expr.$type}`);
  }
}, "transformExpression");
var transformRule = /* @__PURE__ */ __name((rule) => {
  return {
    name: rule.name,
    definition: transformExpression(rule.definition)
  };
}, "transformRule");
var populateDb = /* @__PURE__ */ __name((ast) => {
  populateCommonDb(ast, db);
  if (ast.title) {
    db.setTitle(ast.title);
  }
  ast.rules.map((rule) => db.addRule(transformRule(rule)));
}, "populateDb");
var parser = {
  parse: /* @__PURE__ */ __name((input) => {
    db.clear();
    log.debug("[Railroad Parser] Starting Langium parse");
    const result = langiumParser.parse(input);
    if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
      throw new MermaidParseError(result);
    }
    const ast = result.value;
    log.debug("[Railroad Parser] Parsed rules:", ast.rules.length);
    populateDb(ast);
    log.debug("[Railroad Parser] Parse complete");
  }, "parse"),
  parser: {
    yy: db
  }
};

// src/diagrams/railroad/railroadDiagram.ts
var diagram = {
  parser,
  db,
  renderer,
  styles: getStyles
};
var railroadDiagram_default = diagram;
export {
  railroadDiagram_default as default,
  diagram
};
