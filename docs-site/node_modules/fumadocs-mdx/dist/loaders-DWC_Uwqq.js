//#region src/loaders/index.ts
const metaLoaderGlob = /\.(json|yaml)\?.*(collection|macro_id)=/;
const metaLoaderFileGlob = /\.(json|yaml)$/;
const metaLoaderQueryGlob = /[?&](collection|macro_id)=/;
const mdxLoaderGlob = /\.mdx?(\?.+?)?$/;
//#endregion
export { metaLoaderQueryGlob as i, metaLoaderFileGlob as n, metaLoaderGlob as r, mdxLoaderGlob as t };
