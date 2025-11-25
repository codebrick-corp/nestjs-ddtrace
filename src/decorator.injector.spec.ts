import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, Injectable, UsePipes } from '@nestjs/common';
import { EventPattern, Transport } from '@nestjs/microservices';
import { DatadogTraceModule } from './datadog-trace.module';
import { Span } from './span.decorator';
import { Constants } from './constants';
import { tracer, Span as TraceSpan, Scope } from 'dd-trace';
import * as request from 'supertest';
import { PATH_METADATA, PIPES_METADATA } from '@nestjs/common/constants';
import {
  PATTERN_METADATA,
  PATTERN_HANDLER_METADATA,
  TRANSPORT_METADATA,
} from '@nestjs/microservices/constants';
import { PatternHandler } from '@nestjs/microservices/enums/pattern-handler.enum';
import { NoSpan } from './no-span.decorator';
import { ExceptionFilter } from './exception-filter.types';

describe('DecoratorInjector', () => {
  it('should work with sync function', async () => {
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      hi() {
        return 0;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    const result = helloService.hi();

    // then
    expect(result).toBe(0);
    expect(
      Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
    ).toBe('hello');
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
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
        return new Promise<number>((resolve) => {
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
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    const result = await helloService.hi();

    // then
    expect(result).toBe(0);
    expect(
      Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
    ).toBe('hello');
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
    expect(tracer.startSpan).toHaveBeenCalledWith('hello', { childOf: null });
    expect(tracer.scope().active).toHaveBeenCalled();
    expect(tracer.scope().activate).toHaveBeenCalled();
    expect(mockSpan.finish).toHaveBeenCalled();

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should work with non-async promise function', async () => {
    let resolve;

    const promise = new Promise<number>((_resolve) => {
      resolve = _resolve;
    });
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      hi() {
        return promise;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    const resultPromise = helloService.hi();
    // The span should not be finished before the promise resolves
    expect(mockSpan.finish).not.toHaveBeenCalled();
    resolve(0);
    const result = await resultPromise;

    // then
    expect(result).toBe(0);
    expect(
      Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
    ).toBe('hello');
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
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
      hi() {
        throw new Error('hello');
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
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    expect(() => {
      helloService.hi();
    }).toThrowError('hello');

    // then
    expect(
      Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
    ).toBe('hello');
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
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
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    await expect(helloService.hi()).rejects.toEqual(new Error('hello'));

    // then
    expect(
      Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
    ).toBe('hello');
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
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
      hi() {
        return 0;
      }
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    const result1 = helloService.hi();
    const result2 = helloService.hello();

    // then
    expect(result1).toBe(0);
    expect(result2).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hello,
      ),
    ).toBe(1);
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hello', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(2);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(2);
    expect(mockSpan.finish).toHaveBeenCalledTimes(2);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should exclude provider and all its methods', async () => {
    // given
    @Injectable()
    @NoSpan()
    class HelloService {
      @Span()
      hi() {
        return 0;
      }
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    const result1 = helloService.hi();
    const result2 = helloService.hello();

    // then
    expect(result1).toBe(0);
    expect(result2).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hello,
      ),
    ).toBeUndefined();
    expect(tracer.startSpan).not.toHaveBeenCalled();
    expect(tracer.scope().active).not.toHaveBeenCalled();
    expect(tracer.scope().activate).not.toHaveBeenCalled();
    expect(mockSpan.finish).not.toHaveBeenCalled();

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should exclude methods in provider', async () => {
    // given
    @Injectable()
    @Span()
    class HelloService {
      hi() {
        return 0;
      }
      @NoSpan()
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    const result1 = helloService.hi();
    const result2 = helloService.hello();

    // then
    expect(result1).toBe(0);
    expect(result2).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hello,
      ),
    ).toBeUndefined();
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).not.toHaveBeenCalledWith('HelloService.hello', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(1);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(1);
    expect(mockSpan.finish).toHaveBeenCalledTimes(1);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should work with all methods in controller', async () => {
    // given
    @Controller()
    @Span()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      controllers: [HelloController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    await request(app.getHttpServer()).get('/hi').send().expect(200);
    await request(app.getHttpServer()).get('/hello').send().expect(200);

    // then
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hello,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
    ).toBe('/hi');
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
    ).toBe('/hello');

    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hello', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(2);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(2);
    expect(mockSpan.finish).toHaveBeenCalledTimes(2);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should exclude controller and all its methods', async () => {
    // given
    @Controller()
    @NoSpan()
    class HelloController {
      @Get('/hi')
      @Span()
      hi() {
        return 0;
      }
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      controllers: [HelloController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    await request(app.getHttpServer()).get('/hi').send().expect(200);
    await request(app.getHttpServer()).get('/hello').send().expect(200);

    // then
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hi,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hello,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
    ).toBe('/hi');
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
    ).toBe('/hello');

    expect(tracer.startSpan).not.toHaveBeenCalled();
    expect(tracer.scope().active).not.toHaveBeenCalled();
    expect(tracer.scope().activate).not.toHaveBeenCalled();
    expect(mockSpan.finish).not.toHaveBeenCalled();

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should exclude methods in controller', async () => {
    // given
    @Controller()
    @Span()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @NoSpan()
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      controllers: [HelloController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    await request(app.getHttpServer()).get('/hi').send().expect(200);
    await request(app.getHttpServer()).get('/hello').send().expect(200);

    // then
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hello,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
    ).toBe('/hi');
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
    ).toBe('/hello');

    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).not.toHaveBeenCalledWith('HelloController.hello', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(1);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(1);
    expect(mockSpan.finish).toHaveBeenCalledTimes(1);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should be usable with other annotations', async () => {
    // eslint-disable-next-line prettier/prettier
    const pipe = new (function transform() {})();

    // given
    @Controller()
    @Span()
    class HelloController {
      @EventPattern('pattern1', Transport.KAFKA)
      @UsePipes(pipe, pipe)
      hi() {
        return 0;
      }
      @EventPattern('pattern2', Transport.KAFKA)
      @UsePipes(pipe, pipe)
      hello() {
        return 1;
      }
    }

    await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot()],
      controllers: [HelloController],
    }).compile();

    // then
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(PATTERN_METADATA, HelloController.prototype.hi),
    ).toEqual(['pattern1']);
    expect(
      Reflect.getMetadata(
        PATTERN_HANDLER_METADATA,
        HelloController.prototype.hi,
      ),
    ).toBe(PatternHandler.EVENT);
    expect(
      Reflect.getMetadata(TRANSPORT_METADATA, HelloController.prototype.hi),
    ).toBe(Transport.KAFKA);
    expect(
      Reflect.getMetadata(PIPES_METADATA, HelloController.prototype.hi),
    ).toEqual([pipe, pipe]);

    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hello,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(PATTERN_METADATA, HelloController.prototype.hello),
    ).toEqual(['pattern2']);
    expect(
      Reflect.getMetadata(
        PATTERN_HANDLER_METADATA,
        HelloController.prototype.hello,
      ),
    ).toBe(PatternHandler.EVENT);
    expect(
      Reflect.getMetadata(TRANSPORT_METADATA, HelloController.prototype.hello),
    ).toBe(Transport.KAFKA);
    expect(
      Reflect.getMetadata(PIPES_METADATA, HelloController.prototype.hello),
    ).toEqual([pipe, pipe]);
  });

  it('should work with all methods in controller if options.controllers is enabled', async () => {
    // given
    @Controller()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    @Controller('/foo')
    class WorldController {
      @Get('/bar')
      bar() {
        return 'bar';
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot({ controllers: true })],
      controllers: [HelloController, WorldController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    await request(app.getHttpServer()).get('/hi').send().expect(200);
    await request(app.getHttpServer()).get('/hello').send().expect(200);
    await request(app.getHttpServer()).get('/foo/bar').send().expect(200);

    // then
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hello,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        WorldController.prototype.bar,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
    ).toBe('/hi');
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
    ).toBe('/hello');
    expect(
      Reflect.getMetadata(PATH_METADATA, WorldController.prototype.bar),
    ).toBe('/bar');

    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hello', {
      childOf: null,
    });
    expect(tracer.startSpan).toHaveBeenCalledWith('WorldController.bar', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(3);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(3);
    expect(mockSpan.finish).toHaveBeenCalledTimes(3);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should exclude some methods in controller if options.controllers is enabled', async () => {
    // given
    @Controller()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @NoSpan()
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot({ controllers: true })],
      controllers: [HelloController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    await request(app.getHttpServer()).get('/hi').send().expect(200);
    await request(app.getHttpServer()).get('/hello').send().expect(200);

    // then
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hello,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
    ).toBe('/hi');
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
    ).toBe('/hello');

    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).not.toHaveBeenCalledWith('HelloController.hello', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(1);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(1);
    expect(mockSpan.finish).toHaveBeenCalledTimes(1);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should exclude controller if included in options.excludeControllers', async () => {
    // given
    @Controller()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    @Controller('/foo')
    class WorldController {
      @Get('/bar')
      bar() {
        return 'bar';
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        DatadogTraceModule.forRoot({
          controllers: true,
          excludeControllers: ['WorldController'],
        }),
      ],
      controllers: [HelloController, WorldController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    await request(app.getHttpServer()).get('/hi').send().expect(200);
    await request(app.getHttpServer()).get('/hello').send().expect(200);
    await request(app.getHttpServer()).get('/foo/bar').send().expect(200);

    // then
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hello,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        WorldController.prototype.bar,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
    ).toBe('/hi');
    expect(
      Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
    ).toBe('/hello');
    expect(
      Reflect.getMetadata(PATH_METADATA, WorldController.prototype.bar),
    ).toBe('/bar');

    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloController.hello', {
      childOf: null,
    });
    expect(tracer.startSpan).not.toHaveBeenCalledWith('WorldController.bar', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(2);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(2);
    expect(mockSpan.finish).toHaveBeenCalledTimes(2);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should work with all methods in provider if options.providers is enabled', async () => {
    // given
    @Injectable()
    class HelloService {
      hi() {
        return 0;
      }
      hello() {
        return 1;
      }
    }

    @Injectable()
    class WorldService {
      foo() {
        return 2;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot({ providers: true })],
      providers: [HelloService, WorldService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const worldService = module.get<WorldService>(WorldService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    const result1 = helloService.hi();
    const result2 = helloService.hello();
    const result3 = worldService.foo();

    // then
    expect(result1).toBe(0);
    expect(result2).toBe(1);
    expect(result3).toBe(2);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hello,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        WorldService.prototype.foo,
      ),
    ).toBe(1);
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hello', {
      childOf: null,
    });
    expect(tracer.startSpan).toHaveBeenCalledWith('WorldService.foo', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(3);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(3);
    expect(mockSpan.finish).toHaveBeenCalledTimes(3);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should exclude some methods in provider if options.providers is enabled', async () => {
    // given
    @Injectable()
    class HelloService {
      hi() {
        return 0;
      }
      @NoSpan()
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatadogTraceModule.forRoot({ providers: true })],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    const result1 = helloService.hi();
    const result2 = helloService.hello();

    // then
    expect(result1).toBe(0);
    expect(result2).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hello,
      ),
    ).toBeUndefined();
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).not.toHaveBeenCalledWith('HelloService.hello', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(1);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(1);
    expect(mockSpan.finish).toHaveBeenCalledTimes(1);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  it('should exclude provider if included in options.excludeProviders', async () => {
    // given
    @Injectable()
    class HelloService {
      hi() {
        return 0;
      }
      hello() {
        return 1;
      }
    }

    @Injectable()
    class WorldService {
      foo() {
        return 2;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        DatadogTraceModule.forRoot({
          providers: true,
          excludeProviders: ['WorldService'],
        }),
      ],
      providers: [HelloService, WorldService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const worldService = module.get<WorldService>(WorldService);
    const mockSpan = { finish: jest.fn() as any } as TraceSpan;
    const startSpanSpy = jest
      .spyOn(tracer, 'startSpan')
      .mockReturnValue(mockSpan);
    const scope = {
      active: jest.fn(() => null) as any,
      activate: jest.fn((span: TraceSpan, fn: (...args: any[]) => any): any => {
        return fn();
      }) as any,
    } as Scope;
    const scopeSpy = jest
      .spyOn(tracer, 'scope')
      .mockImplementation(() => scope);

    // when
    const result1 = helloService.hi();
    const result2 = helloService.hello();
    const result3 = worldService.foo();

    // then
    expect(result1).toBe(0);
    expect(result2).toBe(1);
    expect(result3).toBe(2);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloService.prototype.hello,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        WorldService.prototype.foo,
      ),
    ).toBeUndefined();
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hi', {
      childOf: null,
    });
    expect(tracer.startSpan).toHaveBeenCalledWith('HelloService.hello', {
      childOf: null,
    });
    expect(tracer.startSpan).not.toHaveBeenCalledWith('WorldService.foo', {
      childOf: null,
    });
    expect(tracer.scope().active).toHaveBeenCalledTimes(2);
    expect(tracer.scope().activate).toHaveBeenCalledTimes(2);
    expect(mockSpan.finish).toHaveBeenCalledTimes(2);

    startSpanSpy.mockClear();
    scopeSpy.mockClear();
  });

  describe('Exception Filtering', () => {
    it('should record exception when no filter is provided (default behavior)', async () => {
      // given
      @Injectable()
      class TestService {
        @Span('test')
        throwError() {
          throw new Error('test error');
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot()],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // when
      expect(() => {
        testService.throwError();
      }).toThrowError('test error');

      // then
      expect(mockSpan.setTag).toHaveBeenCalledWith(
        'error',
        new Error('test error'),
      );

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should record exception when filter returns true', async () => {
      // given
      @Injectable()
      class TestService {
        @Span('test')
        throwError() {
          throw new Error('test error');
        }
      }

      const exceptionFilter = jest.fn().mockReturnValue(true);

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // when
      expect(() => {
        testService.throwError();
      }).toThrowError('test error');

      // then
      expect(exceptionFilter).toHaveBeenCalledWith(
        new Error('test error'),
        'test',
        'throwError',
      );
      expect(mockSpan.setTag).toHaveBeenCalledWith(
        'error',
        new Error('test error'),
      );

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should not record exception when filter returns false', async () => {
      // given
      @Injectable()
      class TestService {
        @Span('test')
        throwError() {
          throw new Error('test error');
        }
      }

      const exceptionFilter = jest.fn().mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // when
      expect(() => {
        testService.throwError();
      }).toThrowError('test error');

      // then
      expect(exceptionFilter).toHaveBeenCalledWith(
        new Error('test error'),
        'test',
        'throwError',
      );
      expect(mockSpan.setTag).not.toHaveBeenCalled();

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should work with async methods when filter returns false', async () => {
      // given
      @Injectable()
      class TestService {
        @Span('async-test')
        async throwErrorAsync() {
          return new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error('async error')), 10);
          });
        }
      }

      const exceptionFilter = jest.fn().mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // when
      await expect(testService.throwErrorAsync()).rejects.toEqual(
        new Error('async error'),
      );

      // then
      expect(exceptionFilter).toHaveBeenCalledWith(
        new Error('async error'),
        'async-test',
        'throwErrorAsync',
      );
      expect(mockSpan.setTag).not.toHaveBeenCalled();

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should filter based on error properties', async () => {
      // given
      @Injectable()
      class TestService {
        @Span('filter-test')
        throw404() {
          const error = new Error('Not Found');
          (error as any).status = 404;
          throw error;
        }

        @Span('filter-test')
        throw500() {
          const error = new Error('Server Error');
          (error as any).status = 500;
          throw error;
        }
      }

      // Filter out 404 errors but record 500 errors
      const exceptionFilter = jest.fn().mockImplementation((error) => {
        return error.status !== 404;
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // when - 404 error
      expect(() => {
        testService.throw404();
      }).toThrowError('Not Found');

      // then - 404 should not be recorded
      expect(mockSpan.setTag).not.toHaveBeenCalled();

      // reset mock
      (mockSpan.setTag as jest.Mock).mockClear();

      // when - 500 error
      expect(() => {
        testService.throw500();
      }).toThrowError('Server Error');

      // then - 500 should be recorded
      const expectedError = new Error('Server Error');
      (expectedError as any).status = 500;
      expect(mockSpan.setTag).toHaveBeenCalledWith('error', expectedError);

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should filter based on span name and method name', async () => {
      // given
      @Injectable()
      class UserService {
        @Span('user-validation')
        validateUser() {
          const error = new Error('Validation failed');
          error.name = 'ValidationError';
          throw error;
        }
      }

      @Injectable()
      class OrderService {
        @Span('order-processing')
        processOrder() {
          const error = new Error('Validation failed');
          error.name = 'ValidationError';
          throw error;
        }
      }

      // Filter out validation errors only in UserService
      const exceptionFilter = jest
        .fn()
        .mockImplementation((error, spanName, methodName) => {
          if (spanName.includes('user') && error.name === 'ValidationError') {
            return false;
          }
          return true;
        });

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        providers: [UserService, OrderService],
      }).compile();

      const userService = module.get<UserService>(UserService);
      const orderService = module.get<OrderService>(OrderService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // when - UserService validation error
      expect(() => {
        userService.validateUser();
      }).toThrowError('Validation failed');

      // then - should not be recorded
      expect(mockSpan.setTag).not.toHaveBeenCalled();

      // reset mock
      (mockSpan.setTag as jest.Mock).mockClear();

      // when - OrderService validation error
      expect(() => {
        orderService.processOrder();
      }).toThrowError('Validation failed');

      // then - should be recorded
      const expectedError = new Error('Validation failed');
      expectedError.name = 'ValidationError';
      expect(mockSpan.setTag).toHaveBeenCalledWith('error', expectedError);

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should work with controllers and exception filter', async () => {
      // given
      @Controller()
      class TestController {
        @Get('/error')
        @Span('controller-error')
        throwError() {
          const error = new Error('Controller error');
          (error as any).status = 400;
          throw error;
        }
      }

      // Filter out 400 errors
      const exceptionFilter = jest.fn().mockImplementation((error) => {
        return error.status !== 400;
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        controllers: [TestController],
      }).compile();
      const app = module.createNestApplication();
      await app.init();

      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      try {
        // when
        await request(app.getHttpServer()).get('/error').send();
      } catch (error) {
        // expected to throw
      }

      // then
      expect(exceptionFilter).toHaveBeenCalled();
      expect(mockSpan.setTag).not.toHaveBeenCalled();

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should handle filter returning non-boolean values (truthy/falsy evaluation)', async () => {
      // given
      @Injectable()
      class TestService {
        @Span('test')
        throwError() {
          throw new Error('test error');
        }
      }

      const exceptionFilter = jest
        .fn()
        .mockReturnValueOnce(1) // truthy
        .mockReturnValueOnce(0) // falsy
        .mockReturnValueOnce('string') // truthy
        .mockReturnValueOnce('') // falsy
        .mockReturnValueOnce({}) // truthy
        .mockReturnValueOnce(null); // falsy

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // Test truthy values (1, 'string', {})
      expect(() => testService.throwError()).toThrowError('test error'); // 1
      expect(mockSpan.setTag).toHaveBeenCalledWith(
        'error',
        new Error('test error'),
      );
      (mockSpan.setTag as jest.Mock).mockClear();

      expect(() => testService.throwError()).toThrowError('test error'); // 0
      expect(mockSpan.setTag).not.toHaveBeenCalled();
      (mockSpan.setTag as jest.Mock).mockClear();

      expect(() => testService.throwError()).toThrowError('test error'); // 'string'
      expect(mockSpan.setTag).toHaveBeenCalledWith(
        'error',
        new Error('test error'),
      );
      (mockSpan.setTag as jest.Mock).mockClear();

      expect(() => testService.throwError()).toThrowError('test error'); // ''
      expect(mockSpan.setTag).not.toHaveBeenCalled();
      (mockSpan.setTag as jest.Mock).mockClear();

      expect(() => testService.throwError()).toThrowError('test error'); // {}
      expect(mockSpan.setTag).toHaveBeenCalledWith(
        'error',
        new Error('test error'),
      );
      (mockSpan.setTag as jest.Mock).mockClear();

      expect(() => testService.throwError()).toThrowError('test error'); // null
      expect(mockSpan.setTag).not.toHaveBeenCalled();

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should handle undefined/null error objects', async () => {
      // given
      @Injectable()
      class TestService {
        @Span('test')
        throwUndefined() {
          throw undefined;
        }

        @Span('test')
        throwNull() {
          throw null;
        }

        @Span('test')
        throwString() {
          throw 'string error';
        }
      }

      const exceptionFilter = jest.fn().mockReturnValue(true);

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // Test undefined
      expect(() => testService.throwUndefined()).toThrow(undefined);
      expect(exceptionFilter).toHaveBeenCalledWith(
        undefined,
        'test',
        'throwUndefined',
      );
      expect(mockSpan.setTag).toHaveBeenCalledWith('error', undefined);
      (mockSpan.setTag as jest.Mock).mockClear();

      // Test null
      expect(() => testService.throwNull()).toThrow();
      expect(exceptionFilter).toHaveBeenCalledWith(null, 'test', 'throwNull');
      expect(mockSpan.setTag).toHaveBeenCalledWith('error', null);
      (mockSpan.setTag as jest.Mock).mockClear();

      // Test string
      expect(() => testService.throwString()).toThrow('string error');
      expect(exceptionFilter).toHaveBeenCalledWith(
        'string error',
        'test',
        'throwString',
      );
      expect(mockSpan.setTag).toHaveBeenCalledWith('error', 'string error');

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should handle missing span name and method name gracefully', async () => {
      // This tests the fallback behavior when spanName or methodName might be undefined
      @Injectable()
      class TestService {
        throwError() {
          throw new Error('test error');
        }
      }

      const exceptionFilter = jest.fn().mockReturnValue(true);

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          DatadogTraceModule.forRoot({ providers: true, exceptionFilter }),
        ],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // when
      expect(() => testService.throwError()).toThrowError('test error');

      // then - should pass empty strings as fallback for undefined spanName/methodName
      expect(exceptionFilter).toHaveBeenCalledWith(
        new Error('test error'),
        'TestService.throwError', // auto-generated span name
        'throwError',
      );

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should work with complex error objects and custom properties', async () => {
      // given
      @Injectable()
      class TestService {
        @Span('complex-test')
        throwComplexError() {
          const error = new Error('Complex error');
          (error as any).code = 'E_CUSTOM';
          (error as any).statusCode = 422;
          (error as any).details = { field: 'username', issue: 'invalid' };
          (error as any).timestamp = new Date();
          throw error;
        }
      }

      const exceptionFilter = jest.fn().mockImplementation((error) => {
        // Complex filtering logic based on multiple error properties
        return error.code !== 'E_CUSTOM' || error.statusCode >= 500;
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // when
      expect(() => testService.throwComplexError()).toThrowError(
        'Complex error',
      );

      // then - should not record (E_CUSTOM with statusCode < 500)
      expect(exceptionFilter).toHaveBeenCalled();
      const passedError = exceptionFilter.mock.calls[0][0];
      expect(passedError.code).toBe('E_CUSTOM');
      expect(passedError.statusCode).toBe(422);
      expect(passedError.details).toEqual({
        field: 'username',
        issue: 'invalid',
      });
      expect(mockSpan.setTag).not.toHaveBeenCalled();

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should handle async filter functions', async () => {
      // given
      @Injectable()
      class TestService {
        @Span('async-filter-test')
        throwError() {
          throw new Error('test error');
        }
      }

      // Async filter function (though the current implementation doesn't await it,
      // this tests that it doesn't break if someone accidentally returns a Promise)
      const exceptionFilter = jest.fn().mockImplementation(async (error) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return true;
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [DatadogTraceModule.forRoot({ exceptionFilter })],
        providers: [TestService],
      }).compile();

      const testService = module.get<TestService>(TestService);
      const mockSpan = {
        finish: jest.fn() as any,
        setTag: jest.fn() as any,
      } as TraceSpan;
      const startSpanSpy = jest
        .spyOn(tracer, 'startSpan')
        .mockReturnValue(mockSpan);
      const scope = {
        active: jest.fn(() => null) as any,
        activate: jest.fn(
          (span: TraceSpan, fn: (...args: any[]) => any): any => {
            return fn();
          },
        ) as any,
      } as Scope;
      const scopeSpy = jest
        .spyOn(tracer, 'scope')
        .mockImplementation(() => scope);

      // when
      expect(() => testService.throwError()).toThrowError('test error');

      // then - Promise object is truthy, so should record
      expect(exceptionFilter).toHaveBeenCalled();
      expect(mockSpan.setTag).toHaveBeenCalledWith(
        'error',
        new Error('test error'),
      );

      startSpanSpy.mockClear();
      scopeSpy.mockClear();
    });

    it('should handle strong typing and provide good IntelliSense', async () => {
      // This test validates type safety at compile time
      const typeSafeFilter: ExceptionFilter = (error, spanName, methodName) => {
        // Type tests - these should compile without issues
        const errorIsUnknown: unknown = error; // ✓ Should work
        const spanNameIsString: string = spanName; // ✓ Should work
        const methodNameIsString: string = methodName; // ✓ Should work

        // Common patterns should be type-safe
        if (error instanceof Error) {
          return error.message !== 'expected error';
        }

        if (typeof error === 'object' && error !== null && 'status' in error) {
          return (error as any).status >= 500;
        }

        return (
          spanName.includes('critical') || methodName.startsWith('important')
        );
      };

      // Should accept the strongly typed filter
      expect(typeof typeSafeFilter).toBe('function');
      expect(typeSafeFilter(new Error('test'), 'span', 'method')).toBe(true);
    });
  });
});
