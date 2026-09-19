import {
  createFlowDiagram,
  styles_default
} from "./chunk-7M6MHVWA.mjs";
import "./chunk-5VM5RSS4.mjs";
import "./chunk-XXDRQBXY.mjs";
import "./chunk-WEXAMYUT.mjs";
import "./chunk-LNGE3PJU.mjs";
import "./chunk-GNY47TPC.mjs";
import "./chunk-DUW6YSOI.mjs";
import "./chunk-GWA4HPMP.mjs";
import "./chunk-UA2S7LBM.mjs";
import "./chunk-Z7XXMR3K.mjs";
import "./chunk-5DYCD2WN.mjs";
import "./chunk-7INBJB4K.mjs";
import "./chunk-7PRAP22T.mjs";
import "./chunk-MBY4JIJT.mjs";
import "./chunk-742MDFTN.mjs";
import "./chunk-J5ZVWO5B.mjs";
import "./chunk-ZIGJFQKS.mjs";
import "./chunk-O7XYJQB3.mjs";
import "./chunk-X3CZISLH.mjs";
import {
  __name
} from "./chunk-Y2CYZVJY.mjs";

// src/diagrams/swimlanes/styles.ts
var getStyles = /* @__PURE__ */ __name((options) => `${styles_default(options)}
  .swimlane.cluster:not([data-color-id]) rect {
    stroke: ${options.clusterBorder} !important;
  }
  [data-look="neo"].cluster rect {
    filter: none;
  }
`, "getStyles");
var styles_default2 = getStyles;

// src/diagrams/swimlanes/swimlanesDiagram.ts
var diagram = createFlowDiagram({ styles: styles_default2 });
export {
  diagram
};
