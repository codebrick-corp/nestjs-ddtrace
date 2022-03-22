import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, Injectable, UsePipes } from '@nestjs/common';
import { EventPattern, Transport } from '@nestjs/microservices';
import { DatadogTraceModule } from './datadog-trace.module';
import { Span } from './span.decorator';
import { Constants } from './constants';
import { tracer, Span as TraceSpan, Scope } from 'dd-trace';
import * as request from 'supertest';
import { PATH_METADATA, PIPES_METADATA } from '@nestjs/common/constants';
import { PATTERN_METADATA, PATTERN_HANDLER_METADATA, TRANSPORT_METADATA } from '@nestjs/microservices/constants';
import { PatternHandler } from '@nestjs/microservices/enums/pattern-handler.enum';

describe('DecoratorInjector', () => {
  it('should work with sync function', async () => {
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      hi() { return 0; }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest.spyOn(tracer, 'startSpan').mockReturnValue(mockSpan);
    const scope = {
      active: (jest.fn(() => null)) as any,
      activate: jest.fn((span: TraceSpan, fn: ((...args: any[]) => any)): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest.spyOn(tracer, 'scope').mockImplementation(() => scope);

    // when
    const result = helloService.hi();

    // then
    expect(result).toBe(0);
    expect(Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi)).toBe('hello');
    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloService.prototype.hi)).toBe(1);
    expect(tracer.startSpan).toHaveBeenCalledWith('hello', { childOf: null });
    expect(tracer.scope().active).toHaveBeenCalled();
    expect(tracer.scope().activate).toHaveBeenCalled();
    expect(mockSpan.finish).toHaveBeenCalled();

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should work with async function', async () => {
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      async hi() {
        return new Promise<number>(resolve => {
          setTimeout(() => resolve(0), 100);
        });
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest.spyOn(tracer, 'startSpan').mockReturnValue(mockSpan);
    const scope = {
      active: (jest.fn(() => null)) as any,
      activate: jest.fn((span: TraceSpan, fn: ((...args: any[]) => any)): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest.spyOn(tracer, 'scope').mockImplementation(() => scope);

    // when
    const result = await helloService.hi();

    // then
    expect(result).toBe(0);
    expect(Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi)).toBe('hello');
    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloService.prototype.hi)).toBe(1);
    expect(tracer.startSpan).toHaveBeenCalledWith('hello', { childOf: null });
    expect(tracer.scope().active).toHaveBeenCalled();
    expect(tracer.scope().activate).toHaveBeenCalled();
    expect(mockSpan.finish).toHaveBeenCalled();

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should record exception with sync function', async () => {
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      hi() { throw new Error('hello') }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = {
      finish: jest.fn() as any,
      setTag: jest.fn() as any,
    } as TraceSpan;
    const startSpanSpy = jest.spyOn(tracer, 'startSpan').mockReturnValue(mockSpan);
    const scope = {
      active: (jest.fn(() => null)) as any,
      activate: jest.fn((span: TraceSpan, fn: ((...args: any[]) => any)): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest.spyOn(tracer, 'scope').mockImplementation(() => scope);

    // when
    expect(() => {
      helloService.hi();
    }).toThrowError('hello');

    // then
    expect(Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi)).toBe('hello');
    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloService.prototype.hi)).toBe(1);
    expect(tracer.startSpan).toHaveBeenCalledWith('hello', { childOf: null });
    expect(tracer.scope().active).toHaveBeenCalled();
    expect(tracer.scope().activate).toHaveBeenCalled();
    expect(mockSpan.finish).toHaveBeenCalled();
    expect(mockSpan.setTag).toHaveBeenCalledWith('error', new Error('hello'));

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should record exception with async function', async () => {
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      async hi() {
        return new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('hello')), 100);
        });
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = {
      finish: jest.fn() as any,
      setTag: jest.fn() as any,
    } as TraceSpan;
    const startSpanSpy = jest.spyOn(tracer, 'startSpan').mockReturnValue(mockSpan);
    const scope = {
      active: (jest.fn(() => null)) as any,
      activate: jest.fn((span: TraceSpan, fn: ((...args: any[]) => any)): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest.spyOn(tracer, 'scope').mockImplementation(() => scope);

    // when
    await expect(helloService.hi()).rejects.toEqual(new Error('hello'));

    // then
    expect(Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi)).toBe('hello');
    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloService.prototype.hi)).toBe(1);
    expect(tracer.startSpan).toHaveBeenCalledWith('hello', { childOf: null });
    expect(tracer.scope().active).toHaveBeenCalled();
    expect(tracer.scope().activate).toHaveBeenCalled();
    expect(mockSpan.finish).toHaveBeenCalled();
    expect(mockSpan.setTag).toHaveBeenCalledWith('error', new Error('hello'));

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should work with all methods in provider', async () => {
    // given
    @Injectable()
    @Span()
    class HelloService {
      hi() { return 0; }
      hello() { return 1; }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest.spyOn(tracer, 'startSpan').mockReturnValue(mockSpan);
    const scope = {
      active: (jest.fn(() => null)) as any,
      activate: jest.fn((span: TraceSpan, fn: ((...args: any[]) => any)): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest.spyOn(tracer, 'scope').mockImplementation(() => scope);

    // when
    const result1 = helloService.hi();
    const result2 = helloService.hello();

    // then
    expect(result1).toBe(0);
    expect(result2).toBe(1);
    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloService.prototype.hi)).toBe(1);
    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloService.prototype.hello)).toBe(1);
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hi', { childOf: null });
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hello', { childOf: null });
    expect(tracer.scope().active).toHaveBeenCalledTimes(2);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(2);
    expect(mockSpan.finish).toHaveBeenCalledTimes(2);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should work with all methods in controller', async () => {
    // given
    @Controller()
    @Span()
    class HelloController {
      @Get('/hi')
      hi() { return 0; }
      @Get('/hello')
      hello() { return 1; }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      controllers: [HelloController]
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    const helloController = module.get<HelloController>(HelloController);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest.spyOn(tracer, 'startSpan').mockReturnValue(mockSpan);
    const scope = {
      active: (jest.fn(() => null)) as any,
      activate: jest.fn((span: TraceSpan, fn: ((...args: any[]) => any)): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest.spyOn(tracer, 'scope').mockImplementation(() => scope);

    // when
    await request(app.getHttpServer()).get('/hi').send().expect(200);
    await request(app.getHttpServer()).get('/hello').send().expect(200);

    // then
    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloController.prototype.hi)).toBe(1);
    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloController.prototype.hello)).toBe(1);
    expect(Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi)).toBe('/hi');
    expect(Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello)).toBe('/hello');

    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hi', { childOf: null });
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hello', { childOf: null });
    expect(tracer.scope().active).toHaveBeenCalledTimes(2);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(2);
    expect(mockSpan.finish).toHaveBeenCalledTimes(2);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should be usable with other annotations', async () => {
    const pipe = new (function transform() { });

    // given
    @Controller()
    @Span()
    class HelloController {
      @EventPattern('pattern1', Transport.KAFKA)
      @UsePipes(pipe, pipe)
      hi() { return 0; }
      @EventPattern('pattern2', Transport.KAFKA)
      @UsePipes(pipe, pipe)
      hello() { return 1; }
    }

    await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      controllers: [HelloController]
    }).compile();

    // then
    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloController.prototype.hi)).toBe(1);
    expect(Reflect.getMetadata(PATTERN_METADATA, HelloController.prototype.hi)).toBe('pattern1');
    expect(Reflect.getMetadata(PATTERN_HANDLER_METADATA, HelloController.prototype.hi)).toBe(PatternHandler.EVENT);
    expect(Reflect.getMetadata(TRANSPORT_METADATA, HelloController.prototype.hi)).toBe(Transport.KAFKA);
    expect(Reflect.getMetadata(PIPES_METADATA, HelloController.prototype.hi)).toEqual([pipe, pipe]);

    expect(Reflect.getMetadata(Constants.SPAN_METADATA_ACTIVE, HelloController.prototype.hello)).toBe(1);
    expect(Reflect.getMetadata(PATTERN_METADATA, HelloController.prototype.hello)).toBe('pattern2');
    expect(Reflect.getMetadata(PATTERN_HANDLER_METADATA, HelloController.prototype.hello)).toBe(PatternHandler.EVENT);
    expect(Reflect.getMetadata(TRANSPORT_METADATA, HelloController.prototype.hello)).toBe(Transport.KAFKA);
    expect(Reflect.getMetadata(PIPES_METADATA, HelloController.prototype.hello)).toEqual([pipe, pipe]);
  });
});
