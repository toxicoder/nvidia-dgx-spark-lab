import {
  createFlowDiagram,
  styles_default
} from "./chunk-42MQ2CQ3.mjs";
import "./chunk-RRR7N7RX.mjs";
import "./chunk-CJTOMMB5.mjs";
import "./chunk-2TYXY6HD.mjs";
import "./chunk-3QQH2IZE.mjs";
import "./chunk-HQBA3IBE.mjs";
import "./chunk-AWL6KFTE.mjs";
import "./chunk-PT367ZYW.mjs";
import "./chunk-BTGWMLWZ.mjs";
import "./chunk-7XZOGNMF.mjs";
import "./chunk-Q35ELQPF.mjs";
import "./chunk-ICG746PI.mjs";
import "./chunk-AWAWVJFC.mjs";
import "./chunk-2GBIWQ4H.mjs";
import "./chunk-EBKONHZ7.mjs";
import "./chunk-E62FA7JU.mjs";
import "./chunk-K2DFZHL5.mjs";
import "./chunk-TI7YOFXF.mjs";
import "./chunk-445WJIJ4.mjs";
import "./chunk-KMA2NSDO.mjs";
import "./chunk-OHNBJXQ2.mjs";
import {
  __name
} from "./chunk-35ZOQMXA.mjs";

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
