module.exports=[478500,(a,b,c)=>{b.exports=a.x("node:async_hooks",()=>require("node:async_hooks"))},231524,a=>{"use strict";var b=a.i(123623),c=a.i(478500);let d={pre:!1,inline:!1,heading:!1},e=Symbol.for("react.client.reference"),f=Symbol.for("react.lazy"),g=Symbol.for("react.memo"),h=Symbol.for("react.forward_ref"),i=Symbol(),j=new c.AsyncLocalStorage({name:"fumadocs:markdown"});async function k(a){return o(await q(a,d)).trim()}let l=Object.assign(async function(a,...b){let c=function(a){let b=a.join("\0").split("\n");if(1===b.length)return[...a];0===b[0].trim().length&&b.shift();let c=b[b.length-1];b.length>1&&c.length>0&&0===c.trim().length&&b.pop();let d=1/0;for(let a of b)a.trim().length>0&&(d=Math.min(d,/^[ \t]*/.exec(a)[0].length));let e="";for(let a=0;a<b.length;a++)a>0&&(e+="\n"),e+=d===1/0?b[a]:b[a].slice(Math.min(d,b[a].length));return e.split("\0")}(a),d=await Promise.all(b.map(m)),e=c[0];for(let a=0;a<d.length;a++)e+=d[a]+c[a+1];return e},{linePrefix:a=>async(b,...c)=>{let d=(await l(b,...c)).trim();return 0===d.length?"":`
${n(d,a)}

`},indent:(a=2)=>l.linePrefix(" ".repeat(a))});async function m(a){return o(await q(a,d))}function n(a,b){let c=b.trimEnd();return a.replace(/^.*$/gm,a=>0===a.length?c:b+a)}function o(a){return a.replace(/\n{3,}/g,"\n\n")}async function p(a,b){let c={optedIn:!1};try{let d=await j.run(c,()=>a(b));return c.optedIn?d:i}catch(a){if(c.optedIn)throw a;return i}}async function q(a,c){return null==a||"boolean"==typeof a?"":"string"==typeof a?a:"number"==typeof a||"bigint"==typeof a?String(a):E(a)?q(await a,c):(0,b.isValidElement)(a)?r(a.type,a.props,c):"object"==typeof a&&Symbol.iterator in a?(await Promise.all(Array.from(a,a=>q(a,c)))).join(""):""}async function r(a,b,c){var d;if("string"==typeof a)return y(a,b,c);if(("function"==typeof(d=a)||"object"==typeof d&&null!==d)&&d.$$typeof===e)return v(function(a){if("string"!=typeof a)return"Component";try{a=decodeURIComponent(a)}catch{}let b=a.lastIndexOf("#"),c=-1===b?"":a.slice(b+1);if(c&&"default"!==c)return c;let d=(-1===b?a:a.slice(0,b)).split(/[\\/]/).pop(),e="";for(let a of d.replace(/\.[^.]+$/,"").split(/[^\w$]+/))a&&(e+=a[0].toUpperCase()+a.slice(1));return e||"Component"}(a.$$id),b,c);if("function"==typeof a)return s(a,b,c);if("symbol"==typeof a)return q(b.children,c);if("object"==typeof a&&null!==a)switch(a.$$typeof){case f:return r(await t(a),b,c);case g:return r(a.type,b,c);case h:return s(a.render,b,c)}return""}async function s(a,b,c){let d=await p(a,b);return d===i?v(function(a){let{displayName:b,name:c}=a;return"string"==typeof b&&b?b:c||"Component"}(a),b,c):q(d,c)}async function t(a){for(;;)try{return a._init(a._payload)}catch(a){if(!E(a))throw a;await a}}let u=new Set(["children","className","style","tabIndex"]);async function v(a,c,d){let e=`<${a}`;for(let a in c){if(u.has(a))continue;let d=function(a,c){if(!0===c)return a;if(!1!==c&&null!=c){if("string"==typeof c)return c.length>1024?void 0:`${a}=${JSON.stringify(c)}`;if("number"==typeof c||"bigint"==typeof c)return`${a}={${c}}`;if(!("function"==typeof c||"symbol"==typeof c||(0,b.isValidElement)(c)))try{let d=JSON.stringify(c,(a,c)=>(0,b.isValidElement)(c)?void 0:c);if(void 0===d||d.length>1024)return;return`${a}={${d}}`}catch{return}}}(a,c[a]);void 0!==d&&(e+=` ${d}`)}let f=await q(c.children,d);if(d.inline)return 0===f.trim().length?`${e} />`:`${e}>${f}</${a}>`;let g=f.trim();return 0===g.length?`
${e} />

`:`
${e}>
${g}
</${a}>

`}let w=new Set(["a","abbr","b","cite","code","del","em","i","kbd","label","mark","q","s","small","span","strong","sub","sup","time","u"]),x=new Set(["head","link","meta","noscript","script","style","svg","template","title"]);async function y(a,c,d){var e,f;if(x.has(a))return"";if(d.pre)return"br"===a?"\n":q(c.children,d);let g=a=>q(c.children,{...d,...a});switch(a){case"p":{let a=(await g({inline:!0})).trim();return d.inline?`${a} `:`
${a}

`}case"h1":case"h2":case"h3":case"h4":case"h5":case"h6":{let b=(await g({inline:!0,heading:!0})).trim().replace(/\s*\n\s*/g," ");return`
${"#".repeat(Number(a[1]))} ${b}

`}case"a":{let a="string"==typeof c.href?c.href:void 0,b=await g({inline:!0});if(!a||d.heading&&a.startsWith("#"))return b;let e=b.trim();return 0===e.length?`<${a}>`:`[${e}](${a})`}case"strong":case"b":return z(await g({inline:!0}),"**");case"em":case"i":return z(await g({inline:!0}),"*");case"del":case"s":return z(await g({inline:!0}),"~~");case"code":case"kbd":{let a,b,f=await g({inline:!0});if(f.includes("\n")&&!d.inline)return A(C(c),f);return e=f,a="`".repeat(B(e,"`")+1),b=e.startsWith("`")||e.endsWith("`")?" ":"",`${a}${b}${e}${b}${a}`}case"pre":return A(C(c),await g({pre:!0}));case"blockquote":return`
${n(o(await g({inline:!1})).trim(),"> ")}

`;case"ul":case"ol":{let e="ol"===a,f="number"==typeof c.start?c.start:1;return`
${(await Promise.all(D(c.children).map(a=>(0,b.isValidElement)(a)?q(a,{...d,inline:!1,list:{ordered:e,index:f++}}):"string"==typeof a?a.trim():""))).join("")}
`}case"li":{let a=d.list?.ordered?`${d.list.index}. `:"- ";return`${a}${n((await g({inline:!1})).trim().replace(/\n{2,}(?=(?:[-*+] |\d+\. ))/g,"\n")," ".repeat(a.length)).slice(a.length)}
`}case"img":{if("string"!=typeof c.src)return"";let a="string"==typeof c.alt?c.alt:"";return d.inline?`![${a}](${c.src})`:`
![${a}](${c.src})

`}case"hr":return"\n---\n\n";case"br":return"\n";case"table":{let a,b=(await g({inline:!1})).replace(/\n\s*\n/g,"\n").trim();if(0===b.length)return"";let c=b.indexOf("\n"),d=-1===c?b:b.slice(0,c);return`
${d}
${f=d,a=Math.max(1,(f.match(/(?<!\\)\|/g)?.length??2)-1),`|${" --- |".repeat(a)}`}${-1===c?"":b.slice(c)}

`}case"tr":return`|${await g({inline:!1})}
`;case"th":case"td":return` ${(await g({inline:!0})).trim().replace(/\s*\n\s*/g," ").replaceAll("|","\\|")} |`}if(w.has(a))return g({inline:!0});let h=(await g({inline:!1})).trim();return 0===h.length?"":`
${h}

`}function z(a,b){let[,c,d,e]=/^(\s*)([\s\S]*?)(\s*)$/.exec(a);return d?`${c}${b}${d}${b}${e}`:a}function A(a,b){let c=b.replace(/\n$/,""),d="`".repeat(Math.max(3,B(c,"`")+1));return`
${d}${a}
${c}
${d}

`}function B(a,b){let c=0,d=0;for(let e of a)(d=e===b?d+1:0)>c&&(c=d);return c}function C(a){let c=a["data-lang"]??a.lang;if("string"==typeof c&&c.length>0)return c;let d=a=>"string"==typeof a?/(?:^|\s)(?:language|lang)-([\w+#.-]+)/.exec(a)?.[1]:void 0,e=d(a.className);for(let c of D(a.children)){if(e)break;(0,b.isValidElement)(c)&&"code"===c.type&&(e=d(c.props.className))}return e??""}function D(a,c=[]){if(null==a||"boolean"==typeof a)return c;if((0,b.isValidElement)(a))"symbol"==typeof a.type?D(a.props.children,c):c.push(a);else if("object"==typeof a&&Symbol.iterator in a)for(let b of a)D(b,c);else c.push(a);return c}function E(a){return"object"==typeof a&&null!==a&&"function"==typeof a.then}a.s(["renderToMarkdown",0,k])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1unl-7_._.js.map