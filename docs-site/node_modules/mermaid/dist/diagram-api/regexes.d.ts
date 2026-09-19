export declare const frontMatterRegex: RegExp;
export declare const directiveRegex: RegExp;
export declare const anyCommentRegex: RegExp;
/**
 * Strip `%%` comment runs exactly like `text.replace(anyCommentRegex, '\n')`, in linear time.
 *
 * A scanner rather than a regex, because no variant of this pattern is linear. Every regex form
 * carries a `\s*` that can cross newlines, and `/m` gives the engine a candidate start at each
 * line, so an all-whitespace document has the match attempt rescan the remaining run once per
 * line. Two shapes are quadratic in the released pattern and in the guarded `(^|\S)\s*%%.*\n`
 * that replaced it, both inside the default 50k `maxTextSize`:
 *
 * ```
 *   ('\n' + ' '.repeat(4)).repeat(10_000)   all whitespace, many lines   256ms
 *   '%%' + 'x%%'.repeat(16_000)             no terminating newline       339ms
 * ```
 *
 * against 0.1ms for ordinary diagram text of the same size. The guard cut the constant roughly
 * 40x but left the exponent alone, which is what CodeQL and the CWE-1333 review both caught.
 *
 * The scan walks forward once. For each `%%` it takes the line's terminating newline as the end
 * of the match — `.` never matches a newline, so the regex ends at that same character — and
 * extends left over the preceding whitespace run, never past the previous match. Each character
 * is visited at most twice, so the work is linear in the input and independent of how the
 * whitespace is arranged.
 *
 * A `%%` with no newline after it is left alone, because `%%.*\n` cannot match without one.
 */
export declare const stripAnyComments: (text: string) => string;
