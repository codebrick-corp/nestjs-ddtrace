/**
 * Type definition for exception filter function
 */
export type ExceptionFilter = (
  error: unknown,
  spanName: string,
  methodName: string,
) => boolean;

/**
 * Context information passed to exception filter
 */
export interface ExceptionFilterContext {
  readonly error: unknown;
  readonly spanName: string;
  readonly methodName: string;
}
