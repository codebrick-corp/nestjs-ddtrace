import tracer from 'dd-trace';

export const Span = (name?: string) => {
  /**
   * target: Class prototype
   * propertyKey: Method name
   * propertyDescriptor: PropertyDescriptor
   */
  return (target: any, propertyKey: string, propertyDescriptor: PropertyDescriptor) => {
    return {
      get() {
        const method = propertyDescriptor.value;
        const wrapperFn = (...args: any[]) => {
          const activeSpan = tracer.scope().active();
          const span = tracer.startSpan(name || `${target.constructor.name}.${propertyKey}`, { childOf: activeSpan });

          return tracer.scope().activate(span, () => {
            if (method.constructor.name === 'AsyncFunction') {
              return method.apply(this, args).finally(() => {
                span.finish();
              });
            }
            const result = method.apply(this, args);
            span.finish();
            return result;
          });
        };
        
        Object.defineProperty(this, propertyKey, {
          value: wrapperFn,
          configurable: true,
          writable: true
        });

        return wrapperFn;
      }
    }
  };
}
