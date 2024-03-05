import { InjectorOptions } from './injector-options.interface';

export interface Injector {
  inject(options: InjectorOptions): void;
}
