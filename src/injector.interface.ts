export interface Injector {
  inject(options: {
    controllers?: boolean,
    providers?: boolean,
    ignoreProviders?: string[]
  }): void;
}
