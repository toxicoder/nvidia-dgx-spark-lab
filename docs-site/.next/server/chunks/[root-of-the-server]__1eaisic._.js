module.exports=[478500,(e,t,n)=>{t.exports=e.x("node:async_hooks",()=>require("node:async_hooks"))},72415,e=>{"use strict";var t=e.i(172168),n=e.i(478500);let r={pre:!1,inline:!1,heading:!1},i=Symbol.for("react.client.reference"),l=Symbol.for("react.lazy"),a=Symbol.for("react.memo"),o=Symbol.for("react.forward_ref"),s=Symbol(),c=new n.AsyncLocalStorage({name:"fumadocs:markdown"});async function f(e){return y(await $(e,r)).trim()}let u=Object.assign(async function(e,...t){let n=function(e){let t=e.join("\0").split("\n");if(1===t.length)return[...e];0===t[0].trim().length&&t.shift();let n=t[t.length-1];t.length>1&&n.length>0&&0===n.trim().length&&t.pop();let r=1/0;for(let e of t)e.trim().length>0&&(r=Math.min(r,/^[ \t]*/.exec(e)[0].length));let i="";for(let e=0;e<t.length;e++)e>0&&(i+="\n"),i+=r===1/0?t[e]:t[e].slice(Math.min(r,t[e].length));return i.split("\0")}(e),r=await Promise.all(t.map(p)),i=n[0];for(let e=0;e<r.length;e++)i+=r[e]+n[e+1];return i},{linePrefix:e=>async(t,...n)=>{let r=(await u(t,...n)).trim();return 0===r.length?"":`
${h(r,e)}

`},indent:(e=2)=>u.linePrefix(" ".repeat(e))});async function p(e){return y(await $(e,r))}function h(e,t){let n=t.trimEnd();return e.replace(/^.*$/gm,e=>0===e.length?n:t+e)}function y(e){return e.replace(/\n{3,}/g,"\n\n")}async function m(e,t){let n={optedIn:!1};try{let r=await c.run(n,()=>e(t));return n.optedIn?r:s}catch(e){if(n.optedIn)throw e;return s}}async function $(e,n){return null==e||"boolean"==typeof e?"":"string"==typeof e?e:"number"==typeof e||"bigint"==typeof e?String(e):C(e)?$(await e,n):(0,t.isValidElement)(e)?d(e.type,e.props,n):"object"==typeof e&&Symbol.iterator in e?(await Promise.all(Array.from(e,e=>$(e,n)))).join(""):""}async function d(e,t,n){var r;if("string"==typeof e)return v(e,t,n);if(("function"==typeof(r=e)||"object"==typeof r&&null!==r)&&r.$$typeof===i)return x(function(e){if("string"!=typeof e)return"Component";try{e=decodeURIComponent(e)}catch{}let t=e.lastIndexOf("#"),n=-1===t?"":e.slice(t+1);if(n&&"default"!==n)return n;let r=(-1===t?e:e.slice(0,t)).split(/[\\/]/).pop(),i="";for(let e of r.replace(/\.[^.]+$/,"").split(/[^\w$]+/))e&&(i+=e[0].toUpperCase()+e.slice(1));return i||"Component"}(e.$$id),t,n);if("function"==typeof e)return g(e,t,n);if("symbol"==typeof e)return $(t.children,n);if("object"==typeof e&&null!==e)switch(e.$$typeof){case l:return d(await w(e),t,n);case a:return d(e.type,t,n);case o:return g(e.render,t,n)}return""}async function g(e,t,n){let r=await m(e,t);return r===s?x(function(e){let{displayName:t,name:n}=e;return"string"==typeof t&&t?t:n||"Component"}(e),t,n):$(r,n)}async function w(e){for(;;)try{return e._init(e._payload)}catch(e){if(!C(e))throw e;await e}}let b=new Set(["children","className","style","tabIndex"]);async function x(e,n,r){let i=`<${e}`;for(let e in n){if(b.has(e))continue;let r=function(e,n){if(!0===n)return e;if(!1!==n&&null!=n){if("string"==typeof n)return n.length>1024?void 0:`${e}=${JSON.stringify(n)}`;if("number"==typeof n||"bigint"==typeof n)return`${e}={${n}}`;if(!("function"==typeof n||"symbol"==typeof n||(0,t.isValidElement)(n)))try{let r=JSON.stringify(n,(e,n)=>(0,t.isValidElement)(n)?void 0:n);if(void 0===r||r.length>1024)return;return`${e}={${r}}`}catch{return}}}(e,n[e]);void 0!==r&&(i+=` ${r}`)}let l=await $(n.children,r);if(r.inline)return 0===l.trim().length?`${i} />`:`${i}>${l}</${e}>`;let a=l.trim();return 0===a.length?`
${i} />

`:`
${i}>
${a}
</${e}>

`}let S=new Set(["a","abbr","b","cite","code","del","em","i","kbd","label","mark","q","s","small","span","strong","sub","sup","time","u"]),k=new Set(["head","link","meta","noscript","script","style","svg","template","title"]);async function v(e,n,r){var i,l;if(k.has(e))return"";if(r.pre)return"br"===e?"\n":$(n.children,r);let a=e=>$(n.children,{...r,...e});switch(e){case"p":{let e=(await a({inline:!0})).trim();return r.inline?`${e} `:`
${e}

`}case"h1":case"h2":case"h3":case"h4":case"h5":case"h6":{let t=(await a({inline:!0,heading:!0})).trim().replace(/\s*\n\s*/g," ");return`
${"#".repeat(Number(e[1]))} ${t}

`}case"a":{let e="string"==typeof n.href?n.href:void 0,t=await a({inline:!0});if(!e||r.heading&&e.startsWith("#"))return t;let i=t.trim();return 0===i.length?`<${e}>`:`[${i}](${e})`}case"strong":case"b":return j(await a({inline:!0}),"**");case"em":case"i":return j(await a({inline:!0}),"*");case"del":case"s":return j(await a({inline:!0}),"~~");case"code":case"kbd":{let e,t,l=await a({inline:!0});if(l.includes("\n")&&!r.inline)return E(N(n),l);return i=l,e="`".repeat(I(i,"`")+1),t=i.startsWith("`")||i.endsWith("`")?" ":"",`${e}${t}${i}${t}${e}`}case"pre":return E(N(n),await a({pre:!0}));case"blockquote":return`
${h(y(await a({inline:!1})).trim(),"> ")}

`;case"ul":case"ol":{let i="ol"===e,l="number"==typeof n.start?n.start:1;return`
${(await Promise.all(V(n.children).map(e=>(0,t.isValidElement)(e)?$(e,{...r,inline:!1,list:{ordered:i,index:l++}}):"string"==typeof e?e.trim():""))).join("")}
`}case"li":{let e=r.list?.ordered?`${r.list.index}. `:"- ";return`${e}${h((await a({inline:!1})).trim().replace(/\n{2,}(?=(?:[-*+] |\d+\. ))/g,"\n")," ".repeat(e.length)).slice(e.length)}
`}case"img":{if("string"!=typeof n.src)return"";let e="string"==typeof n.alt?n.alt:"";return r.inline?`![${e}](${n.src})`:`
![${e}](${n.src})

`}case"hr":return"\n---\n\n";case"br":return"\n";case"table":{let e,t=(await a({inline:!1})).replace(/\n\s*\n/g,"\n").trim();if(0===t.length)return"";let n=t.indexOf("\n"),r=-1===n?t:t.slice(0,n);return`
${r}
${l=r,e=Math.max(1,(l.match(/(?<!\\)\|/g)?.length??2)-1),`|${" --- |".repeat(e)}`}${-1===n?"":t.slice(n)}

`}case"tr":return`|${await a({inline:!1})}
`;case"th":case"td":return` ${(await a({inline:!0})).trim().replace(/\s*\n\s*/g," ").replaceAll("|","\\|")} |`}if(S.has(e))return a({inline:!0});let o=(await a({inline:!1})).trim();return 0===o.length?"":`
${o}

`}function j(e,t){let[,n,r,i]=/^(\s*)([\s\S]*?)(\s*)$/.exec(e);return r?`${n}${t}${r}${t}${i}`:e}function E(e,t){let n=t.replace(/\n$/,""),r="`".repeat(Math.max(3,I(n,"`")+1));return`
${r}${e}
${n}
${r}

`}function I(e,t){let n=0,r=0;for(let i of e)(r=i===t?r+1:0)>n&&(n=r);return n}function N(e){let n=e["data-lang"]??e.lang;if("string"==typeof n&&n.length>0)return n;let r=e=>"string"==typeof e?/(?:^|\s)(?:language|lang)-([\w+#.-]+)/.exec(e)?.[1]:void 0,i=r(e.className);for(let n of V(e.children)){if(i)break;(0,t.isValidElement)(n)&&"code"===n.type&&(i=r(n.props.className))}return i??""}function V(e,n=[]){if(null==e||"boolean"==typeof e)return n;if((0,t.isValidElement)(e))"symbol"==typeof e.type?V(e.props.children,n):n.push(e);else if("object"==typeof e&&Symbol.iterator in e)for(let t of e)V(t,n);else n.push(e);return n}function C(e){return"object"==typeof e&&null!==e&&"function"==typeof e.then}e.s(["renderToMarkdown",0,f])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1eaisic._.js.map