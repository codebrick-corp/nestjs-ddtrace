import { DynamicModule, Module } from '@nestjs/common';
import { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import { TraceService } from './trace.service';
import { DecoratorInjector } from './decorator.injector';
import { Injector } from 'src/injector.interface';
import { Constants } from './constants';

@Module({})
export class DatadogTraceModule {
  static forRoot(options: {
    /**
     * if true, automatically add a span to all controllers.
     */
    controllers?: boolean,
    /**
     * * if true, automatically add a span to all providers.
     */
    providers?: boolean,
    ignoreProviders?: string[]
  } = {}): DynamicModule {
    return {
      global: true,
      module: DatadogTraceModule,
      providers: [TraceService, DecoratorInjector, this.buildInjectors(options)],
      exports: [TraceService]
    }
  }

  private static buildInjectors(options: {
    controllers?: boolean,
    providers?: boolean
  }): FactoryProvider {
    return {
      provide: Constants.TRACE_INJECTORS,
      useFactory: async (...injectors: Injector[]) => {
        for await (const injector of injectors) {
          if (injector.inject) await injector.inject(options);
        }
      },
      inject: [DecoratorInjector]
    }
  }
}
