import {
  parse
} from "./chunk-PP7T2VXU.mjs";
import "./chunk-VJXJ5QCJ.mjs";
import "./chunk-3GRS7R6R.mjs";
import "./chunk-G2A2OEYH.mjs";
import "./chunk-MULULVMI.mjs";
import "./chunk-O5H7SEHM.mjs";
import "./chunk-6WE5GGNG.mjs";
import "./chunk-KD5VN4N6.mjs";
import "./chunk-G6AM5BRH.mjs";
import "./chunk-J74O3ZRR.mjs";
import "./chunk-2JN552EF.mjs";
import "./chunk-Q77HCHBN.mjs";
import "./chunk-KIWDUUFH.mjs";
import "./chunk-JDESJKT4.mjs";
import "./chunk-ZEJ26CLT.mjs";
import "./chunk-YOWFEKIV.mjs";
import "./chunk-WLRJLAWP.mjs";
import {
  selectSvgElement
} from "./chunk-VD2MO4BW.mjs";
import {
  configureSvgSize
} from "./chunk-KMA2NSDO.mjs";
import {
  log
} from "./chunk-OHNBJXQ2.mjs";
import {
  __name
} from "./chunk-35ZOQMXA.mjs";

// src/diagrams/info/infoParser.ts
var parser = {
  parse: /* @__PURE__ */ __name(async (input) => {
    const ast = await parse("info", input);
    log.debug(ast);
  }, "parse")
};

// src/diagrams/info/infoDb.ts
var DEFAULT_INFO_DB = {
  version: "12.0.0" + (true ? "" : "-tiny")
};
var getVersion = /* @__PURE__ */ __name(() => DEFAULT_INFO_DB.version, "getVersion");
var db = {
  getVersion
};

// src/diagrams/info/infoRenderer.ts
var draw = /* @__PURE__ */ __name((text, id, version) => {
  log.debug("rendering info diagram\n" + text);
  const svg = selectSvgElement(id);
  configureSvgSize(svg, 100, 400, true);
  const group = svg.append("g");
  group.append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${version}`);
}, "draw");
var renderer = { draw };

// src/diagrams/info/infoDiagram.ts
var diagram = {
  parser,
  db,
  renderer
};
export {
  diagram
};
