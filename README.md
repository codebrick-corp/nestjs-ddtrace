# NestJS Datadog Trace

## Install

```sh
npm i nestjs-ddtrace
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

2. Import the tracing file

    ```ts
    import './dd_tracing';
    import { NestFactory } from '@nestjs/core';
    import { AppModule } from './app.module';
    import { Logger } from 'nestjs-pino';

    async function bootstrap() {
      const app = await NestFactory.create(AppModule, { bufferLogs: true });
      app.useLogger(app.get(Logger));
      await app.listen(3000);
    }
    bootstrap();
    ```

## Span Decorator

If you need, you can define a custom Tracing Span for a method. It works async or sync. Span takes its name from the parameter; but by default, it is the same as the method's name.

```ts
@Module({
  imports: [DatadogTraceModule],
})
export class AppModule {}
```

## Tracing Service

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
    this.traceService.getActiveSpan().addTags({
      'getBooks': 'true'
    });

    const childSpan = this.traceService.getTracer().startSpan('ms', {childOf: currentSpan});
    span.setTag('userId', 1);
    await this.doSomethingElse();
    span.finish(); // new span ends
    return [`Harry Potter and the Philosopher's Stone`];
  }
}
```
