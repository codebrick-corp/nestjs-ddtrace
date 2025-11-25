import { DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import { TraceService } from './trace.service';
import { DecoratorInjector } from './decorator.injector';
import { Injector } from 'src/injector.interface';
import { Constants } from './constants';
import { DatadogTraceModuleOptions } from './datadog-trace-module-options.interface';

interface DatadogTraceAsyncModuleOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<DatadogTraceModuleOptions> | DatadogTraceModuleOptions;
  inject: any[];
}
const DATADOG_TRACE_MODULE_PARAMS = Symbol('DATADOG_TRACE_MODULE_PARAMS');


export class DatadogTraceModule {
  static forRoot(options: DatadogTraceModuleOptions = {}): DynamicModule {
    return {
      global: true,
      module: DatadogTraceModule,
      providers: [
        TraceService,
        DecoratorInjector,
        {
          provide: Constants.TRACE_INJECTORS,
          useFactory: async (...injectors: Injector[]) => {
            for await (const injector of injectors) {
              if (injector.inject) await injector.inject(options);
            }
          },
          inject: [DecoratorInjector],
        }
      ],
      exports: [TraceService],
    };
  }

  static forRootAsync(options: DatadogTraceAsyncModuleOptions): DynamicModule {
    return {
      global: true,
      module: DatadogTraceModule,
      imports: options.imports ?? [],
      providers: [
        TraceService,
        DecoratorInjector,
        {
          provide: DATADOG_TRACE_MODULE_PARAMS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        {
          provide: Constants.TRACE_INJECTORS,
          inject: [DATADOG_TRACE_MODULE_PARAMS, DecoratorInjector],
          useFactory: async (moduleOptions: DatadogTraceModuleOptions, ...injectors: Injector[]) => {
            for await (const injector of injectors) {
              if (injector.inject) await injector.inject(moduleOptions);
            }
          },
        }
      ],
      exports: [TraceService],
    };
  }
}
