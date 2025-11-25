import { Test } from '@nestjs/testing';
import { DatadogTraceModule } from './datadog-trace.module';
import { TraceService } from './trace.service';
import type { DatadogTraceModuleOptions } from './datadog-trace-module-options.interface';
import { Injectable, Module } from '@nestjs/common';

describe('DatadogTraceModule', () => {
	it('forRoot should register TraceService, DecoratorInjector and TRACE_INJECTORS provider', async () => {
		const options: DatadogTraceModuleOptions = {};

		const moduleRef = await Test.createTestingModule({
			imports: [DatadogTraceModule.forRoot(options)],
		}).compile();

		// exports
		expect(moduleRef.get(TraceService)).toBeInstanceOf(TraceService);
	});


	it('forRootAsync should resolve options via factory and export TraceService', async () => {
		@Injectable()
		class CustomService {
			getOptions(): DatadogTraceModuleOptions {
				return { providers: true };
			}
		}

		@Module({
			providers: [CustomService],
			exports: [CustomService],
		})
		class CustomModule { }

		const moduleRef = await Test.createTestingModule({
			imports: [
				DatadogTraceModule.forRootAsync({
					imports: [CustomModule],
					inject: [CustomService],
					useFactory: async (customService: CustomService) => {
						return await customService.getOptions()
					},
				}),
			],
		}).compile();

		expect(moduleRef.get(TraceService)).toBeInstanceOf(TraceService);
	});
});
