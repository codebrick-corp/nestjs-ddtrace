
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
}
