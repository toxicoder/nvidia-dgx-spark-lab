import { CnFunction, Engine } from "./types.js";
import { ClassGroupDef, CnConfig, ConfigExtension, CreateCnInput, mergeConfigs } from "./compiler.js";

//#region src/default-config.generated.d.ts
/** A fresh copy of the default config (marker form; safe to mutate). */
declare const getDefaultCnConfig: () => CnConfig;
/** every class-group id in the default config (autocomplete for extensions) */
type DefaultClassGroupIds = "aspect" | "container" | "container-type" | "container-named" | "columns" | "break-after" | "break-before" | "break-inside" | "box-decoration" | "box" | "display" | "sr" | "float" | "clear" | "isolation" | "object-fit" | "object-position" | "overflow" | "overflow-x" | "overflow-y" | "overscroll" | "overscroll-x" | "overscroll-y" | "position" | "inset" | "inset-x" | "inset-y" | "start" | "end" | "inset-bs" | "inset-be" | "top" | "right" | "bottom" | "left" | "visibility" | "z" | "basis" | "flex-direction" | "flex-wrap" | "flex" | "grow" | "shrink" | "order" | "grid-cols" | "col-start-end" | "col-start" | "col-end" | "grid-rows" | "row-start-end" | "row-start" | "row-end" | "grid-flow" | "auto-cols" | "auto-rows" | "gap" | "gap-x" | "gap-y" | "justify-content" | "justify-items" | "justify-self" | "align-content" | "align-items" | "align-self" | "place-content" | "place-items" | "place-self" | "p" | "px" | "py" | "ps" | "pe" | "pbs" | "pbe" | "pt" | "pr" | "pb" | "pl" | "m" | "mx" | "my" | "ms" | "me" | "mbs" | "mbe" | "mt" | "mr" | "mb" | "ml" | "space-x" | "space-x-reverse" | "space-y" | "space-y-reverse" | "size" | "inline-size" | "min-inline-size" | "max-inline-size" | "block-size" | "min-block-size" | "max-block-size" | "w" | "min-w" | "max-w" | "h" | "min-h" | "max-h" | "font-size" | "font-smoothing" | "font-style" | "font-weight" | "font-stretch" | "font-family" | "font-features" | "fvn-normal" | "fvn-ordinal" | "fvn-slashed-zero" | "fvn-figure" | "fvn-spacing" | "fvn-fraction" | "tracking" | "line-clamp" | "leading" | "list-image" | "list-style-position" | "list-style-type" | "text-alignment" | "placeholder-color" | "text-color" | "text-decoration" | "text-decoration-style" | "text-decoration-thickness" | "text-decoration-color" | "underline-offset" | "text-transform" | "text-overflow" | "text-wrap" | "indent" | "tab-size" | "vertical-align" | "whitespace" | "break" | "wrap" | "hyphens" | "content" | "bg-attachment" | "bg-clip" | "bg-origin" | "bg-position" | "bg-repeat" | "bg-size" | "bg-image" | "bg-color" | "gradient-from-pos" | "gradient-via-pos" | "gradient-to-pos" | "gradient-from" | "gradient-via" | "gradient-to" | "rounded" | "rounded-s" | "rounded-e" | "rounded-t" | "rounded-r" | "rounded-b" | "rounded-l" | "rounded-ss" | "rounded-se" | "rounded-ee" | "rounded-es" | "rounded-tl" | "rounded-tr" | "rounded-br" | "rounded-bl" | "border-w" | "border-w-x" | "border-w-y" | "border-w-s" | "border-w-e" | "border-w-bs" | "border-w-be" | "border-w-t" | "border-w-r" | "border-w-b" | "border-w-l" | "divide-x" | "divide-x-reverse" | "divide-y" | "divide-y-reverse" | "border-style" | "divide-style" | "border-color" | "border-color-x" | "border-color-y" | "border-color-s" | "border-color-e" | "border-color-bs" | "border-color-be" | "border-color-t" | "border-color-r" | "border-color-b" | "border-color-l" | "divide-color" | "outline-style" | "outline-offset" | "outline-w" | "outline-color" | "shadow" | "shadow-color" | "inset-shadow" | "inset-shadow-color" | "ring-w" | "ring-w-inset" | "ring-color" | "ring-offset-w" | "ring-offset-color" | "inset-ring-w" | "inset-ring-color" | "text-shadow" | "text-shadow-color" | "opacity" | "mix-blend" | "bg-blend" | "mask-clip" | "mask-composite" | "mask-image-linear-pos" | "mask-image-linear-from-pos" | "mask-image-linear-to-pos" | "mask-image-linear-from-color" | "mask-image-linear-to-color" | "mask-image-t-from-pos" | "mask-image-t-to-pos" | "mask-image-t-from-color" | "mask-image-t-to-color" | "mask-image-r-from-pos" | "mask-image-r-to-pos" | "mask-image-r-from-color" | "mask-image-r-to-color" | "mask-image-b-from-pos" | "mask-image-b-to-pos" | "mask-image-b-from-color" | "mask-image-b-to-color" | "mask-image-l-from-pos" | "mask-image-l-to-pos" | "mask-image-l-from-color" | "mask-image-l-to-color" | "mask-image-x-from-pos" | "mask-image-x-to-pos" | "mask-image-x-from-color" | "mask-image-x-to-color" | "mask-image-y-from-pos" | "mask-image-y-to-pos" | "mask-image-y-from-color" | "mask-image-y-to-color" | "mask-image-radial" | "mask-image-radial-from-pos" | "mask-image-radial-to-pos" | "mask-image-radial-from-color" | "mask-image-radial-to-color" | "mask-image-radial-shape" | "mask-image-radial-size" | "mask-image-radial-pos" | "mask-image-conic-pos" | "mask-image-conic-from-pos" | "mask-image-conic-to-pos" | "mask-image-conic-from-color" | "mask-image-conic-to-color" | "mask-mode" | "mask-origin" | "mask-position" | "mask-repeat" | "mask-size" | "mask-type" | "mask-image" | "filter" | "blur" | "brightness" | "contrast" | "drop-shadow" | "drop-shadow-color" | "grayscale" | "hue-rotate" | "invert" | "saturate" | "sepia" | "backdrop-filter" | "backdrop-blur" | "backdrop-brightness" | "backdrop-contrast" | "backdrop-grayscale" | "backdrop-hue-rotate" | "backdrop-invert" | "backdrop-opacity" | "backdrop-saturate" | "backdrop-sepia" | "border-collapse" | "border-spacing" | "border-spacing-x" | "border-spacing-y" | "table-layout" | "caption" | "transition" | "transition-behavior" | "duration" | "ease" | "delay" | "animate" | "backface" | "perspective" | "perspective-origin" | "rotate" | "rotate-x" | "rotate-y" | "rotate-z" | "scale" | "scale-x" | "scale-y" | "scale-z" | "scale-3d" | "skew" | "skew-x" | "skew-y" | "transform" | "transform-origin" | "transform-style" | "translate" | "translate-x" | "translate-y" | "translate-z" | "translate-none" | "zoom" | "accent" | "appearance" | "caret-color" | "color-scheme" | "cursor" | "field-sizing" | "pointer-events" | "resize" | "scroll-behavior" | "scrollbar-thumb-color" | "scrollbar-track-color" | "scrollbar-gutter" | "scrollbar-w" | "scroll-m" | "scroll-mx" | "scroll-my" | "scroll-ms" | "scroll-me" | "scroll-mbs" | "scroll-mbe" | "scroll-mt" | "scroll-mr" | "scroll-mb" | "scroll-ml" | "scroll-p" | "scroll-px" | "scroll-py" | "scroll-ps" | "scroll-pe" | "scroll-pbs" | "scroll-pbe" | "scroll-pt" | "scroll-pr" | "scroll-pb" | "scroll-pl" | "snap-align" | "snap-stop" | "snap-type" | "snap-strictness" | "touch" | "touch-x" | "touch-y" | "touch-pz" | "select" | "will-change" | "fill" | "stroke-w" | "stroke" | "forced-color-adjust" | "contain" | "contain-size" | "contain-layout" | "contain-paint" | "contain-style";
/** every theme scale key in the default config */
type DefaultThemeGroupIds = "animate" | "aspect" | "blur" | "breakpoint" | "color" | "container" | "drop-shadow" | "ease" | "font" | "font-weight" | "inset-shadow" | "leading" | "perspective" | "radius" | "shadow" | "spacing" | "text" | "text-shadow" | "tracking";
//#endregion
//#region src/config.d.ts
/** Reference a theme scale from a class-group definition. */
declare const fromTheme: (key: string) => {
  $t: string;
};
/**
 * Marker-form validators for custom class groups (compiled to allocation-free
 * span opcodes — prefer these over passing tailwind-merge's validator
 * functions, which run as slower custom validators).
 */
declare const validators: {
  readonly isAny: {
    readonly $v: "isAny";
  };
  readonly isAnyNonArbitrary: {
    readonly $v: "isAnyNonArbitrary";
  };
  readonly isArbitraryValue: {
    readonly $v: "isArbitraryValue";
  };
  readonly isArbitraryVariable: {
    readonly $v: "isArbitraryVariable";
  };
  readonly isFraction: {
    readonly $v: "isFraction";
  };
  readonly isNumber: {
    readonly $v: "isNumber";
  };
  readonly isInteger: {
    readonly $v: "isInteger";
  };
  readonly isPercent: {
    readonly $v: "isPercent";
  };
  readonly isTshirtSize: {
    readonly $v: "isTshirtSize";
  };
  readonly isNamedContainerQuery: {
    readonly $v: "isNamedContainerQuery";
  };
  readonly isArbitraryLength: {
    readonly $v: "isArbitraryLength";
  };
  readonly isArbitraryNumber: {
    readonly $v: "isArbitraryNumber";
  };
  readonly isArbitraryWeight: {
    readonly $v: "isArbitraryWeight";
  };
  readonly isArbitraryFamilyName: {
    readonly $v: "isArbitraryFamilyName";
  };
  readonly isArbitraryPosition: {
    readonly $v: "isArbitraryPosition";
  };
  readonly isArbitrarySize: {
    readonly $v: "isArbitrarySize";
  };
  readonly isArbitraryImage: {
    readonly $v: "isArbitraryImage";
  };
  readonly isArbitraryShadow: {
    readonly $v: "isArbitraryShadow";
  };
  readonly isArbitraryVariableLength: {
    readonly $v: "isArbitraryVariableLength";
  };
  readonly isArbitraryVariableFamilyName: {
    readonly $v: "isArbitraryVariableFamilyName";
  };
  readonly isArbitraryVariablePosition: {
    readonly $v: "isArbitraryVariablePosition";
  };
  readonly isArbitraryVariableSize: {
    readonly $v: "isArbitraryVariableSize";
  };
  readonly isArbitraryVariableImage: {
    readonly $v: "isArbitraryVariableImage";
  };
  readonly isArbitraryVariableShadow: {
    readonly $v: "isArbitraryVariableShadow";
  };
  readonly isArbitraryVariableWeight: {
    readonly $v: "isArbitraryVariableWeight";
  };
};
/**
 * Create a `cn` function for a custom config. Accepts a tailwind-merge–style
 * `{ extend, override, prefix }` extension, a `(defaultConfig) => config`
 * transform, or a complete config. Compilation is lazy: the first call pays
 * ~3 ms once, every later call runs at full engine speed.
 *
 * ```ts
 * const cn = createCn({
 *     extend: { classGroups: { "font-size": [{ text: ["hero", "tiny"] }] } },
 * })
 * ```
 */
declare const createCn: (input?: CreateCnInput) => CnFunction;
/**
 * tailwind-merge–compatible variadic merge for a custom config — the
 * `extendTailwindMerge` migration path.
 */
declare const createTwMerge: (input?: CreateCnInput) => Engine["merge"];
/**
 * Familiar-name alias for tailwind-merge migrations:
 * `extendTailwindMerge(ext)` ≡ `createTwMerge(ext)`.
 */
declare const extendTailwindMerge: (input?: CreateCnInput) => Engine["merge"];
//#endregion
export { type ClassGroupDef, type CnConfig, type ConfigExtension, type CreateCnInput, type DefaultClassGroupIds, type DefaultThemeGroupIds, createCn, createTwMerge, getDefaultCnConfig as defaultConfig, extendTailwindMerge, fromTheme, mergeConfigs, validators };