# NestJS Datadog Trace

## Install

```sh
npm i nestjs-ddtrace --save
```

## Setup

1. Create tracing file (tracing.ts):

    ```ts
    import tracer from 'dd-trace';

    // initialized in a different file to avoid hoisting.
    tracer.init({
      // https://docs.datadoghq.com/tracing/connect_logs_and_traces/nodejs/
      logInjection: true
    });
    export default tracer;

    ```

2. Import the tracing file:

    ```ts
    import './tracing';
    import { NestFactory } from '@nestjs/core';
    import { AppModule } from './app.module';
    import { Logger as PinoLogger } from 'nestjs-pino';
    import { Logger } from '@nestjs/common';

    async function bootstrap() {
      const app = await NestFactory.create(AppModule, { bufferLogs: true });
      app.useLogger(app.get(PinoLogger));

      const logger = new Logger('main');
      const port = process.env.PORT || 3000;
      await app.listen(3000).then(() => {
        logger.log(`Listening on port: ${port}`);
      });
    }
    bootstrap();
    ```

3. Add *LoggerModule* and *DatadogModule* to *AppModule*:

    ```ts
    import { Module } from '@nestjs/common';
    import { LoggerModule } from 'nestjs-pino';
    import { DatadogTraceModule } from 'nestjs-ddtrace';

    @Module({
      imports: [LoggerModule.forRoot({
        pinoHttp: {
          level: process.env.ENV !== 'prod' ? 'trace' : 'info'
        }
      }), DatadogTraceModule.forRoot()],
    })
    export class AppModule {}
    ```

## Span Decorator

If you need, you can define a custom Tracing Span for a method or class. It works async or sync. Span takes its name from the parameter; but by default, it is the same as the method's name.

```ts
import { DatadogTraceModule } from 'nestjs-ddtrace';

@Module({
  imports: [DatadogTraceModule.forRoot()],
})

export class AppModule {}
```

### Tracing Service

In case you need to access native span methods for special logics in the method block:

```ts
import { Span, TraceService } from 'nestjs-ddtrace';

@Injectable()
export class BookService {
  constructor(private readonly traceService: TraceService) {}

  @Span()
  async getBooks() {
    const currentSpan = this.traceService.getActiveSpan(); // --> retrives current span, comes from http or @Span
    await this.doSomething();
    currentSpan.addTags({
      'getBooks': 'true'
    });

    const childSpan = this.traceService.getTracer().startSpan('ms', {childOf: currentSpan});
    childSpan.setTag('userId', 1);
    await this.doSomethingElse();
    childSpan.finish(); // new span ends

    try {
      doSomething();
    } catch (e) {
      currentSpan.setTag('error', e);
      throw e;
    }
    return [`Harry Potter and the Philosopher's Stone`];
  }
}
```

```ts
import { Span } from 'nestjs-ddtrace';

@Injectable()
@Span()
export class BookService {
  async getBooks() { ... }
  async deleteBook(id: string) { ... }
}

@Controller()
@Span()
export class HelloController {
  @Get('/books')
  getBooks() { ... }

  @Delete('/books/:id')
  deleteBooks() { ... }
}
```

## No Span Decorator

If you need to explicitly exclude a method or class from having a custom tracing Span then
you can explicitly exclude it.

```ts
import { NoSpan, Span } from 'nestjs-ddtrace';

@Injectable()
@Span()
export class BookService {
  async getBooks() { ... }
  @NoSpan()
  async deleteBook(id: string) { ... }
}

@Controller()
@NoSpan()
export class HelloController {
  @Get('/books')
  getBooks() { ... }

  @Delete('/books/:id')
  deleteBooks() { ... }
}
```

## Custom tracing spans for all controllers and providers

Custom tracing spans can be enabled for all controllers
and providers using the `controllers` and `providers` options.

```ts
import { DatadogTraceModule } from 'nestjs-ddtrace';

@Module({
  imports: [DatadogTraceModule.forRoot({
      controllers: true,
      providers: true,
    })],
})

export class AppModule {}
```

Controllers and providers can be excluded by including their name in
either the `excludeControllers` or `excludeProviders` options.

This may be useful for:

- having a single place to specify what should be excluded
- excluding controllers and providers you do not own so using the `@NoSpan` decorator is not an option.

```ts
import { DatadogTraceModule } from 'nestjs-ddtrace';

@Module({
  imports: [DatadogTraceModule.forRoot({
      controllers: true,
      providers: true,
      excludeProviders: ['TraceService'],
    })],
})

export class AppModule {}
```

## Exception Filtering

You can filter which exceptions are recorded in spans using the `exceptionFilter` option. This is useful for excluding recoverable errors, expected exceptions, or specific error types from your traces.

The filter function receives the error, span name, and method name, and should return `true` to record the exception or `false` to skip it.

### Basic Exception Filtering

```ts
import { DatadogTraceModule } from 'nestjs-ddtrace';

@Module({
  imports: [DatadogTraceModule.forRoot({
      controllers: true,
      providers: true,
      exceptionFilter: (error, spanName, methodName) => {
        // Skip recording 404 errors
        if (error && typeof error === 'object' && 'status' in error) {
          return error.status !== 404;
        }
        
        // Record all other exceptions
        return true;
      }
    })],
})
export class AppModule {}
```

### Advanced Exception Filtering

```ts
import { DatadogTraceModule } from 'nestjs-ddtrace';

@Module({
  imports: [DatadogTraceModule.forRoot({
      controllers: true,
      providers: true,
      exceptionFilter: (error, spanName, methodName) => {
        // Skip client errors (4xx) but record server errors (5xx)
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) {
            return false; // Don't record 4xx errors
          }
        }
        
        // Skip validation errors in user service methods
        if (spanName.includes('UserService') && 
            error instanceof Error && 
            error.name === 'ValidationError') {
          return false;
        }
        
        // Skip expected business logic errors
        if (error instanceof Error && 
            error.message.includes('EXPECTED_')) {
          return false;
        }
        
        // Record everything else
        return true;
      }
    })],
})
export class AppModule {}
```

### Exception Filter Use Cases

- **Skip client errors**: Don't record 4xx HTTP errors that are client-side issues
- **Filter validation errors**: Exclude expected validation failures
- **Service-specific filtering**: Apply different rules based on the service/method name
- **Business logic errors**: Skip recoverable errors that are part of normal flow
- **Rate limiting**: Avoid recording rate limit exceeded errors

**Note**: If the exception filter function throws an error, the original exception will be recorded as a fail-safe measure, and the filter error will be logged for debugging.

## Miscellaneous

Inspired by the [nestjs-otel](https://github.com/pragmaticivan/nestjs-otel) and [nestjs-opentelemetry](https://github.com/MetinSeylan/Nestjs-OpenTelemetry#readme) repository.
