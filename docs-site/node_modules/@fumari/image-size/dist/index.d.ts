//#region src/lib/source.d.ts
interface RequestOptions {
  /**
   * Abort each request after this many milliseconds.
   * Pass `0` (or `Infinity`) to wait forever.
   *
   * @defaultValue 30000
   */
  timeout?: number;
  /**
   * Extra headers to send.
   */
  headers?: Record<string, string>;
}
//#endregion
//#region src/types.d.ts
type ImageType = 'avif' | 'bmp' | 'gif' | 'heic' | 'heif' | 'ico' | 'jpg' | 'png' | 'psd' | 'svg' | 'tiff' | 'webp';
interface ImageSize {
  /** in pixels */
  width: number;
  /** in pixels */
  height: number;
}
interface ImageSizeResult extends ImageSize {
  type: ImageType;
  mime: string;
  /**
   * Every size a multi-size container holds (ICO, and AVIF collections).
   * Only set when there is more than one, `width`/`height` hold the largest.
   */
  variants?: ImageSize[];
}
/**
 * Returns `undefined` when the data isn't this format *or* when it doesn't hold
 * enough bytes yet — callers retry with more data rather than distinguishing.
 */
type Parser = (data: Uint8Array) => ImageSizeResult | undefined;
//#endregion
//#region src/error.d.ts
type ImageSizeErrorCode =
/** the bytes aren't a supported image */
'ECONTENT' |
/** the server answered with a non-2xx status */
'EHTTP' |
/** the request outlived `timeout` */
'ETIMEDOUT';
export declare class ImageSizeError extends Error {
  code?: ImageSizeErrorCode;
  /** HTTP status, set when `code` is `EHTTP`. */
  statusCode?: number;
  constructor(message: string, code?: ImageSizeErrorCode, statusCode?: number);
}
//#endregion
//#region src/index.d.ts
export interface ProbeOptions extends RequestOptions {
  /**
   * Stop the sequential scan after this many bytes. A TIFF pointing past this
   * is still resolved — its dimensions are read right where the header says.
   *
   * @defaultValue 524288
   */
  limit?: number;
}
/**
 * Read the size of a fully loaded image.
 *
 * Returns `null` when the data isn't a supported image — including when it is
 * simply too short, so a partial image can be retried with more bytes.
 */
export declare function imageSize(data: Uint8Array): ImageSizeResult | null;
/**
 * Read the size of an image from a file path or an `http(s)` URL, downloading
 * (or reading) no more than the header it takes to answer.
 *
 * @param src - a path, a `file:` URL, or an `http(s)` URL
 * @throws {ImageSizeError} when the image can't be read or isn't a supported format
 */
export declare function probe(src: string | URL, { limit, ...request }?: ProbeOptions): Promise<ImageSizeResult>;
//#endregion
export type { ImageSize, ImageSizeErrorCode, ImageSizeResult, ImageType, Parser, RequestOptions };