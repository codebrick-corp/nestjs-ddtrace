import { DynamicModule, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import { TraceService } from './trace.service';
import { DecoratorInjector } from './decorator.injector';
import { Injector } from 'src/injector.interface';
import { Constants } from './constants';

@Module({})
export class DatadogTraceModule {
  static forRoot(): DynamicModule {
    return {
      global: true,
      module: DatadogTraceModule,
      providers: [TraceService, DecoratorInjector, this.buildInjectors()],
      exports: [TraceService]
    }
  }

  private static buildInjectors(): FactoryProvider {
    return {
      provide: Constants.TRACE_INJECTORS,
      useFactory: async (...injectors: Injector[]) => {
        for await (const injector of injectors) {
          if (injector.inject) await injector.inject();
        }
      },
      inject: [DecoratorInjector]
    }
  }
}
