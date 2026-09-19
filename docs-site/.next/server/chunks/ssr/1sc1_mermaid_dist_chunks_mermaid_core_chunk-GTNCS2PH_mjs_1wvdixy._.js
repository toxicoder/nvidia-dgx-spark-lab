module.exports=[914536,a=>{"use strict";var b=a.i(548124),c=a.i(584875),d=a.i(333458),e=a.i(121953),f="",g="",h="",i=[],j=new Map,k=(0,e.__name)(a=>(0,c.sanitizeText)(a,(0,c.getConfig2)()),"sanitizeText"),l=(0,e.__name)(a=>{switch(a.type){case"terminal":return{...a,value:k(a.value)};case"nonterminal":return{...a,name:k(a.name)};case"sequence":return{...a,elements:a.elements.map(l)};case"choice":return{...a,alternatives:a.alternatives.map(l)};case"optional":return{...a,element:l(a.element)};case"repetition":return{...a,element:l(a.element),separator:a.separator?l(a.separator):void 0};case"special":return{...a,text:k(a.text)}}},"sanitizeAstNode"),m=(0,e.__name)(()=>{f="",g="",h="",i.length=0,j.clear(),(0,c.clear)(),d.log.debug("[Railroad] Database cleared")},"clear"),n=(0,e.__name)(a=>{f=k(a),d.log.debug("[Railroad] Title set:",a)},"setTitle"),o=(0,e.__name)(()=>f,"getTitle"),p=(0,e.__name)(a=>{let b={...a,name:k(a.name),definition:l(a.definition),comment:a.comment?k(a.comment):void 0};d.log.debug("[Railroad] Adding rule:",b.name),j.has(b.name)&&d.log.warn(`[Railroad] Rule '${b.name}' is already defined. Overwriting.`),i.push(b),j.set(b.name,b)},"addRule"),q=(0,e.__name)(()=>i,"getRules"),r=(0,e.__name)(a=>j.get(a),"getRule"),s=(0,e.__name)(a=>{g=k(a).replace(/^\s+/g,""),d.log.debug("[Railroad] Accessibility title set:",a)},"setAccTitle"),t=(0,e.__name)(()=>g,"getAccTitle"),u=(0,e.__name)(a=>{h=k(a).replace(/\n\s+/g,"\n"),d.log.debug("[Railroad] Accessibility description set:",a)},"setAccDescription"),v={clear:m,setTitle:n,getTitle:o,addRule:p,getRules:q,getRule:r,setAccTitle:s,getAccTitle:t,setAccDescription:u,getAccDescription:(0,e.__name)(()=>h,"getAccDescription"),setDiagramTitle:n,getDiagramTitle:o},w={compactMode:!1,padding:10,verticalSeparation:8,horizontalSeparation:10,arcRadius:10,fontSize:14,fontFamily:"monospace",terminalFill:"#FFFFC0",terminalStroke:"#000000",terminalTextColor:"#000000",nonTerminalFill:"#FFFFFF",nonTerminalStroke:"#000000",nonTerminalTextColor:"#000000",lineColor:"#000000",strokeWidth:2,markerFill:"#000000",commentFill:"#E8E8E8",commentStroke:"#888888",commentTextColor:"#666666",specialFill:"#F0E0FF",specialStroke:"#8800CC",ruleNameColor:"#000066",showMarkers:!0,markerRadius:5},x=/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$|^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([\d\s%+,./-]+\)$|^[a-z]+$/i,y=/^[\w "',.-]+$/,z=new Set(["compactMode","padding","verticalSeparation","horizontalSeparation","arcRadius","fontSize","fontFamily","terminalFill","terminalStroke","terminalTextColor","nonTerminalFill","nonTerminalStroke","nonTerminalTextColor","lineColor","strokeWidth","markerFill","commentFill","commentStroke","commentTextColor","specialFill","specialStroke","ruleNameColor","showMarkers","markerRadius"]),A=(0,e.__name)(a=>!!a&&Object.keys(a).every(a=>"railroad"===a||z.has(a)),"isRailroadStyleOptions"),B=(0,e.__name)(a=>a?"railroad"in a&&a.railroad?a.railroad:A(a)?a:{}:{},"extractRailroadOverrides"),C=(0,e.__name)(a=>{if(!a||A(a))return{};let{railroad:b,svgId:c,theme:d,look:e,...f}=a;return f},"extractThemeOverrides"),D=(0,e.__name)((a,b)=>{if("string"!=typeof a)return b;let c=a.trim();return x.test(c)?c:b},"sanitizeColorValue"),E=(0,e.__name)((a,b)=>{if("string"!=typeof a)return b;let c=a.trim();return y.test(c)?c:b},"sanitizeFontFamilyValue"),F=(0,e.__name)((a,b)=>{let c="number"==typeof a?a:"string"==typeof a?Number.parseFloat(a):NaN;return Number.isFinite(c)&&c>=0?c:b},"sanitizeNumberValue"),G=(0,e.__name)(a=>{let b="number"==typeof a?a:"string"==typeof a?Number.parseFloat(a):NaN;return Number.isFinite(b)&&b>0?b:void 0},"parseThemeFontSize"),H=(0,e.__name)(a=>{let b=E(a.fontFamily,w.fontFamily),c=G(a.fontSize)??w.fontSize;return{...w,fontFamily:b,fontSize:c,terminalFill:D(a.secondBkg??a.secondaryColor,w.terminalFill),terminalStroke:D(a.secondaryBorderColor??a.lineColor,w.terminalStroke),terminalTextColor:D(a.secondaryTextColor??a.textColor,w.terminalTextColor),nonTerminalFill:D(a.mainBkg??a.background,w.nonTerminalFill),nonTerminalStroke:D(a.primaryBorderColor??a.lineColor,w.nonTerminalStroke),nonTerminalTextColor:D(a.primaryTextColor??a.textColor,w.nonTerminalTextColor),lineColor:D(a.lineColor,w.lineColor),markerFill:D(a.lineColor,w.markerFill),commentFill:D(a.labelBackground??a.tertiaryColor,w.commentFill),commentStroke:D(a.tertiaryBorderColor??a.lineColor,w.commentStroke),commentTextColor:D(a.tertiaryTextColor??a.textColor,w.commentTextColor),specialFill:D(a.tertiaryColor??a.secondaryColor,w.specialFill),specialStroke:D(a.tertiaryBorderColor??a.secondaryBorderColor,w.specialStroke),ruleNameColor:D(a.titleColor??a.textColor,w.ruleNameColor)}},"buildThemeDefaults"),I=(0,e.__name)(a=>{let b=(0,c.getConfig)(),d=H({...(0,c.getThemeVariables)(),...b.themeVariables??{},...C(a)}),e={...b.railroad??{},...B(a)};return{compactMode:e.compactMode??d.compactMode,padding:F(e.padding,d.padding),verticalSeparation:F(e.verticalSeparation,d.verticalSeparation),horizontalSeparation:F(e.horizontalSeparation,d.horizontalSeparation),arcRadius:F(e.arcRadius,d.arcRadius),fontSize:F(e.fontSize,d.fontSize),fontFamily:E(e.fontFamily,d.fontFamily),terminalFill:D(e.terminalFill,d.terminalFill),terminalStroke:D(e.terminalStroke,d.terminalStroke),terminalTextColor:D(e.terminalTextColor,d.terminalTextColor),nonTerminalFill:D(e.nonTerminalFill,d.nonTerminalFill),nonTerminalStroke:D(e.nonTerminalStroke,d.nonTerminalStroke),nonTerminalTextColor:D(e.nonTerminalTextColor,d.nonTerminalTextColor),lineColor:D(e.lineColor,d.lineColor),strokeWidth:F(e.strokeWidth,d.strokeWidth),markerFill:D(e.markerFill,d.markerFill),commentFill:D(e.commentFill,d.commentFill),commentStroke:D(e.commentStroke,d.commentStroke),commentTextColor:D(e.commentTextColor,d.commentTextColor),specialFill:D(e.specialFill,d.specialFill),specialStroke:D(e.specialStroke,d.specialStroke),ruleNameColor:D(e.ruleNameColor,d.ruleNameColor),showMarkers:e.showMarkers??d.showMarkers,markerRadius:F(e.markerRadius,d.markerRadius)}},"buildRailroadStyleOptions"),J=(0,e.__name)(a=>{let{fontFamily:b,fontSize:c,terminalFill:d,terminalStroke:e,terminalTextColor:f,nonTerminalFill:g,nonTerminalStroke:h,nonTerminalTextColor:i,lineColor:j,strokeWidth:k,markerFill:l,commentFill:m,commentStroke:n,commentTextColor:o,specialFill:p,specialStroke:q,ruleNameColor:r}=I(a);return`
  .railroad-diagram {
    font-family: ${b};
    font-size: ${c}px;
  }

  .railroad-terminal rect {
    fill: ${d};
    stroke: ${e};
    stroke-width: ${k}px;
  }

  .railroad-terminal text {
    fill: ${f};
    font-family: ${b};
    font-size: ${c}px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .railroad-nonterminal rect {
    fill: ${g};
    stroke: ${h};
    stroke-width: ${k}px;
  }

  .railroad-nonterminal text {
    fill: ${i};
    font-family: ${b};
    font-size: ${c}px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .railroad-line {
    stroke: ${j};
    stroke-width: ${k}px;
    fill: none;
  }

  .railroad-start circle,
  .railroad-end circle {
    fill: ${l};
  }

  .railroad-comment ellipse {
    fill: ${m};
    stroke: ${n};
    stroke-width: ${k}px;
  }

  .railroad-comment text {
    fill: ${o};
    font-style: italic;
    font-family: ${b};
    font-size: ${c}px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .railroad-special rect {
    fill: ${p};
    stroke: ${q};
    stroke-width: ${k}px;
    stroke-dasharray: 5,3;
  }

  .railroad-special text {
    fill: ${i};
    font-family: ${b};
    font-size: ${c}px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .railroad-rule-name {
    font-weight: bold;
    fill: ${r};
    font-family: ${b};
    font-size: ${c}px;
  }

  .railroad-group {
    /* Grouping container, no specific styles */
  }
`},"getStyles"),K=class{constructor(){this.d=""}static{(0,e.__name)(this,"PathBuilder")}moveTo(a,b){return this.d+=`M ${a} ${b} `,this}lineTo(a,b){return this.d+=`L ${a} ${b} `,this}horizontalTo(a){return this.d+=`H ${a} `,this}verticalTo(a){return this.d+=`V ${a} `,this}arcTo(a,b,c,d,e,f,g){return this.d+=`A ${a} ${b} ${c} ${+!!d} ${+!!e} ${f} ${g} `,this}build(){return this.d.trim()}},L=class{constructor(a,b=I()){this.textCache=new Map,this.svg=a,this.config=b}static{(0,e.__name)(this,"RailroadRenderer")}measureText(a){if(this.textCache.has(a))return this.textCache.get(a);let b=this.svg.append("text").attr("font-family",this.config.fontFamily).attr("font-size",this.config.fontSize).text(a),c=b.node().getBBox(),d={width:c.width,height:c.height};return b.remove(),this.textCache.set(a,d),d}renderTerminal(a,b){let c=this.measureText(b),d=c.width+2*this.config.padding,e=c.height+2*this.config.padding,f=a.append("g").attr("class","railroad-terminal");return f.append("rect").attr("x",0).attr("y",0).attr("width",d).attr("height",e).attr("rx",10).attr("ry",10),f.append("text").attr("x",d/2).attr("y",e/2).text(b),{element:f.node(),dimensions:{width:d,height:e,up:e/2,down:e/2}}}renderNonTerminal(a,b){let c=this.measureText(b),d=c.width+2*this.config.padding,e=c.height+2*this.config.padding,f=a.append("g").attr("class","railroad-nonterminal");return f.append("rect").attr("x",0).attr("y",0).attr("width",d).attr("height",e),f.append("text").attr("x",d/2).attr("y",e/2).text(b),{element:f.node(),dimensions:{width:d,height:e,up:e/2,down:e/2}}}renderSequence(a,b){let c=b.map(b=>this.renderExpression(a,b)),d=0,e=0,f=0;for(let a of c)d+=a.dimensions.width,e=Math.max(e,a.dimensions.up),f=Math.max(f,a.dimensions.down);d+=(c.length-1)*this.config.horizontalSeparation;let g=a.append("g").attr("class","railroad-sequence"),h=0;for(let a=0;a<c.length;a++){let b=c[a],d=e-b.dimensions.up;if(g.node().appendChild(b.element).setAttribute("transform",`translate(${h}, ${d})`),a<c.length-1){let a=h+b.dimensions.width,c=a+this.config.horizontalSeparation,d=e;g.append("path").attr("class","railroad-line").attr("d",new K().moveTo(a,d).lineTo(c,d).build())}h+=b.dimensions.width+this.config.horizontalSeparation}return{element:g.node(),dimensions:{width:d,height:e+f,up:e,down:f}}}renderChoice(a,b){let c=b.map(b=>this.renderExpression(a,b)),d=0,e=0;for(let a of c)d=Math.max(d,a.dimensions.width),e+=a.dimensions.height;e+=(c.length-1)*this.config.verticalSeparation;let f=this.config.arcRadius,g=d+4*f,h=a.append("g").attr("class","railroad-choice"),i=0,j=e/2;for(let a of c){let b=i,c=b+a.dimensions.up,e=2*f+(d-a.dimensions.width)/2;h.node().appendChild(a.element).setAttribute("transform",`translate(${e}, ${b})`);let k=new K,l=c>j;c===j?k.moveTo(0,j).lineTo(e,c):k.moveTo(0,j).arcTo(f,f,0,!1,l,f,j+(l?f:-f)).lineTo(f,c-(l?f:-f)).arcTo(f,f,0,!1,!l,2*f,c).lineTo(e,c),h.append("path").attr("class","railroad-line").attr("d",k.build());let m=new K,n=e+a.dimensions.width,o=g-2*f;c===j?m.moveTo(n,c).lineTo(g,j):m.moveTo(n,c).lineTo(o,c).arcTo(f,f,0,!1,!l,g-f,c+(l?-f:f)).lineTo(g-f,j+(l?f:-f)).arcTo(f,f,0,!1,l,g,j),h.append("path").attr("class","railroad-line").attr("d",m.build()),i+=a.dimensions.height+this.config.verticalSeparation}return{element:h.node(),dimensions:{width:g,height:e,up:j,down:e-j}}}renderOptional(a,b){let c=this.renderExpression(a,b),d=this.config.arcRadius,e=2*d,f=c.dimensions.width+4*d,g=c.dimensions.height+e,h=a.append("g").attr("class","railroad-optional"),i=2*d;h.node().appendChild(c.element).setAttribute("transform",`translate(${i}, ${e})`);let j=e+c.dimensions.up,k=new K().moveTo(0,j).lineTo(2*d,j);h.append("path").attr("class","railroad-line").attr("d",k.build());let l=new K().moveTo(i+c.dimensions.width,j).lineTo(f,j);h.append("path").attr("class","railroad-line").attr("d",l.build());let m=new K().moveTo(0,j).arcTo(d,d,0,!1,!1,d,j-d).lineTo(d,d).arcTo(d,d,0,!1,!0,2*d,0).lineTo(f-2*d,0).arcTo(d,d,0,!1,!0,f-d,d).lineTo(f-d,j-d).arcTo(d,d,0,!1,!1,f,j);return h.append("path").attr("class","railroad-line").attr("d",m.build()),{element:h.node(),dimensions:{width:f,height:g,up:j,down:g-j}}}renderRepetition(a,b,c){let d=this.renderExpression(a,b),e=this.config.arcRadius,f=2*e,g=d.dimensions.width+4*e,h=0===c,i=d.dimensions.height+f+(h?f:0),j=a.append("g").attr("class","railroad-repetition"),k=2*e,l=h?f:0;j.node().appendChild(d.element).setAttribute("transform",`translate(${k}, ${l})`);let m=l+d.dimensions.up;j.append("path").attr("class","railroad-line").attr("d",new K().moveTo(0,m).lineTo(2*e,m).build()),j.append("path").attr("class","railroad-line").attr("d",new K().moveTo(k+d.dimensions.width,m).lineTo(g,m).build());let n=l+d.dimensions.height+e,o=new K().moveTo(k+d.dimensions.width,m).arcTo(e,e,0,!1,!0,k+d.dimensions.width+e,m+e).lineTo(k+d.dimensions.width+e,n).arcTo(e,e,0,!1,!0,k+d.dimensions.width,n+e).lineTo(2*e,n+e).arcTo(e,e,0,!1,!0,e,n).lineTo(e,m+e).arcTo(e,e,0,!1,!0,2*e,m);if(j.append("path").attr("class","railroad-line").attr("d",o.build()),h){let a=new K().moveTo(0,m).arcTo(e,e,0,!1,!1,e,m-e).lineTo(e,e).arcTo(e,e,0,!1,!0,2*e,0).lineTo(g-2*e,0).arcTo(e,e,0,!1,!0,g-e,e).lineTo(g-e,m-e).arcTo(e,e,0,!1,!1,g,m);j.append("path").attr("class","railroad-line").attr("d",a.build())}return{element:j.node(),dimensions:{width:g,height:i,up:m,down:i-m}}}renderSpecial(a,b){let c=this.measureText("? "+b+" ?"),d=c.width+2*this.config.padding,e=c.height+2*this.config.padding,f=a.append("g").attr("class","railroad-special");return f.append("rect").attr("x",0).attr("y",0).attr("width",d).attr("height",e),f.append("text").attr("x",d/2).attr("y",e/2).text("? "+b+" ?"),{element:f.node(),dimensions:{width:d,height:e,up:e/2,down:e/2}}}renderExpression(a,b){switch(b.type){case"terminal":return this.renderTerminal(a,b.value);case"nonterminal":return this.renderNonTerminal(a,b.name);case"sequence":return this.renderSequence(a,b.elements);case"choice":return this.renderChoice(a,b.alternatives);case"optional":return this.renderOptional(a,b.element);case"repetition":return this.renderRepetition(a,b.element,b.min);case"special":return this.renderSpecial(a,b.text);default:throw Error(`Unknown node type: ${b.type}`)}}renderRule(a,b){let c=this.svg.append("g").attr("class","railroad-rule").attr("transform",`translate(0, ${b})`),d=a.name+" =",e=this.measureText(d).width+20,f=e+20,g=c.append("g"),h=this.renderExpression(g,a.definition),i=Math.max(20,h.dimensions.up),j=i-h.dimensions.up;return g.attr("transform",`translate(${f}, ${j})`),c.append("g").attr("class","railroad-rule-name-group").append("text").attr("class","railroad-rule-name").attr("x",0).attr("y",i).text(d),c.append("g").attr("class","railroad-start").append("circle").attr("cx",e).attr("cy",i).attr("r",this.config.markerRadius),c.append("g").attr("class","railroad-end").append("circle").attr("cx",f+h.dimensions.width+10).attr("cy",i).attr("r",this.config.markerRadius),c.append("path").attr("class","railroad-line").attr("d",new K().moveTo(e+this.config.markerRadius,i).lineTo(f,i).build()),c.append("path").attr("class","railroad-line").attr("d",new K().moveTo(f+h.dimensions.width,i).lineTo(f+h.dimensions.width+10-this.config.markerRadius,i).build()),{height:Math.max(40,j+h.dimensions.height+2*this.config.padding),width:f+h.dimensions.width+10+this.config.markerRadius}}renderDiagram(a){let b=this.config.padding,c=0;for(let d of a){let a=this.renderRule(d,b);b+=a.height+this.config.verticalSeparation,c=Math.max(c,a.width)}return{width:c+2*this.config.padding,height:b+this.config.padding}}},M=(0,e.__name)((a,b,d)=>{(0,c.configureSvgSize)(a,b.height,b.width,d),a.attr("viewBox",`0 0 ${b.width} ${b.height}`)},"configureRailroadSvgSize"),N=(0,e.__name)((a,e,f)=>{d.log.debug("[Railroad] Rendering diagram\n"+a);try{let a=(0,b.selectSvgElement)(e);a.attr("class","railroad-diagram");let f=(0,c.getConfig)().railroad,g=f?.useMaxWidth??!0,h=v.getRules();if(d.log.debug(`[Railroad] Rendering ${h.length} rules`),0===h.length){d.log.warn("[Railroad] No rules to render"),M(a,{height:100,width:200},g);return}let i=new L(a,I()).renderDiagram(h);M(a,i,g),d.log.debug("[Railroad] Render complete")}catch(a){throw d.log.error("[Railroad] Render error:",a),a}},"draw");a.s(["db",0,v,"getStyles",0,J,"renderer",0,{draw:N}])}];

//# sourceMappingURL=1sc1_mermaid_dist_chunks_mermaid_core_chunk-GTNCS2PH_mjs_1wvdixy._.js.map