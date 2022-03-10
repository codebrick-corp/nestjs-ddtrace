import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TraceService } from './trace/trace.service';

@Module({})
export class DatadogTraceModule {
  static forRoot(): DynamicModule {
    const providers: Provider[] = [
      { provide: TraceService, useValue: new TraceService() },
    ];

    return {
      module: DatadogTraceModule,
      providers,
      exports: providers
    }
  }
}
