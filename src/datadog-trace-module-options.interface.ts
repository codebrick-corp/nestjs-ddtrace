import { ExceptionFilter } from './exception-filter.types';

export interface DatadogTraceModuleOptions {
  /**
   * if true, automatically add a span to all controllers.
   */
  controllers?: boolean;
  /**
   * if true, automatically add a span to all providers.
   */
  providers?: boolean;
  /**
   * list of controller names to exclude when controllers option is true.
   */
  excludeControllers?: string[];
  /**
   * list of provider names to exclude when controllers option is true.
   */
  excludeProviders?: string[];
  /**
   * Optional filter function to determine which exceptions should be recorded in spans.
   * Returns true if the exception should be recorded, false to skip recording.
   * If not provided, all exceptions will be recorded (default behavior).
   *
   * @param error - The error/exception that was thrown (can be any type)
   * @param spanName - The name of the span where the error occurred
   * @param methodName - The name of the method where the error occurred
   * @returns boolean indicating whether to record the exception in the span
   */
  exceptionFilter?: ExceptionFilter;
}
