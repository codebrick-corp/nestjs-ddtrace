import { Injectable } from '@nestjs/common';
import tracer, { Span, Tracer } from 'dd-trace';

@Injectable()
export class TraceService {
  public getTracer(): Tracer {
    return tracer;
  }

  public getActiveSpan(): Span | null {
    return tracer.scope().active();
  }
}
