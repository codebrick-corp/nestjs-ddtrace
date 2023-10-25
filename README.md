# NestJS Datadog Trace

## Install

```sh
npm i nestjs-ddtrace --save
```

## Setup

1. Create tracing file (tracting.ts):

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

## Miscellaneous

Inspired by the [nestjs-otel](https://github.com/pragmaticivan/nestjs-otel) and [nestjs-opentelemetry](https://github.com/MetinSeylan/Nestjs-OpenTelemetry#readme) repository.
