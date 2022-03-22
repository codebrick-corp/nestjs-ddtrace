import { Injectable, Logger } from '@nestjs/common';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Constants } from './Constants';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { Controller, Injectable as InjectableInterface } from '@nestjs/common/interfaces';
import { tracer, Span } from 'dd-trace';
import { Injector } from './injector.interface';

@Injectable()
export class DecoratorInjector implements Injector {
  private readonly metadataScanner: MetadataScanner = new MetadataScanner();
  private readonly logger = new Logger();

  constructor(private readonly modulesContainer: ModulesContainer) { }

  public inject() {
    this.injectProviders();
    this.injectControllers();
  }

  /**
   * Returns whether the prototype is annotated with @Span or not.
   * @param prototype
   * @returns
   */
  private isDecorated(prototype): boolean {
    return Reflect.hasMetadata(Constants.SPAN_METADATA, prototype);
  }

  /**
   * Returns whether the prototype has already applied wrapper or not.
   * @param prototype
   * @returns
   */
  private isAffected(prototype): boolean {
    return Reflect.hasMetadata(Constants.SPAN_METADATA_ACTIVE, prototype);
  }

  /**
   * Returns the span name specified in span annotation.
   * @param prototype
   * @returns
   */
  private getSpanName(prototype): string {
    return Reflect.getMetadata(Constants.SPAN_METADATA, prototype);
  }

  /**
   * Tag the error that occurred in span.
   * @param error
   * @param span
   */
  private static recordException(error, span: Span) {
    span.setTag('error', error);
    throw error;
  }

  /**
   * Find providers with span annotation and wrap method.
   */
  private injectProviders() {
    const providers = this.getProviders();

    for (const provider of providers) {
      const isProviderDecorated = this.isDecorated(provider.metatype);
      const methodNames = this.metadataScanner.getAllFilteredMethodNames(provider.metatype.prototype);

      for (const methodName of methodNames) {
        const method = provider.metatype.prototype[methodName];

        // If span annotation is attached to class, @Span is applied to all methods.
        if ((isProviderDecorated && !this.isAffected(method)) || (this.isDecorated(method) && !this.isAffected(method))) {
          const spanName = this.getSpanName(method) || `${provider.name}.${methodName}`;
          provider.metatype.prototype[methodName] = this.wrap(method, spanName);

          this.logger.log(`Mapped ${provider.name}.${methodName}`, this.constructor.name);
        }
      }
    }
  }

  /**
   * Find controllers with span annotation and wrap method.
   */
  private injectControllers() {
    const controllers = this.getControllers();

    for (const controller of controllers) {
      const isControllerDecorated = this.isDecorated(controller.metatype);
      const methodNames = this.metadataScanner.getAllFilteredMethodNames(controller.metatype.prototype);

      for (const methodName of methodNames) {
        const method = controller.metatype.prototype[methodName];

        // If span annotation is attached to class, @Span is applied to all methods.
        if ((isControllerDecorated && !this.isAffected(method)) || (this.isDecorated(method) && !this.isAffected(method))) {
          const spanName = this.getSpanName(method) || `${controller.name}.${methodName}`;
          controller.metatype.prototype[methodName] = this.wrap(method, spanName);

          this.logger.log(`Mapped ${controller.name}.${methodName}`, this.constructor.name);
        }
      }

    }
  }

  /**
   * Wrap the method
   * @param prototype
   * @param spanName
   * @returns
   */
  private wrap(prototype: Record<any, any>, spanName: string) {
    const method = {
      // To keep function.name property
      [prototype.name]: function (...args: any[]) {
        const activeSpan = tracer.scope().active();
        const span = tracer.startSpan(spanName, { childOf: activeSpan });

        return tracer.scope().activate(span, () => {
          if (prototype.constructor.name === 'AsyncFunction') {
            return prototype
              .apply(this, args)
              .catch(error => {
                DecoratorInjector.recordException(error, span);
              })
              .finally(() => span.finish());
          } else {
            try {
              const result = prototype.apply(this, args);
              return result;
            } catch (error) {
              DecoratorInjector.recordException(error, span);
            } finally {
              span.finish();
            }
          }
        });
      }
    }[prototype.name];

    // Reflect.defineMetadata(Constants.SPAN_METADATA, spanName, method);

    // Flag that wrapping is done
    Reflect.defineMetadata(Constants.SPAN_METADATA_ACTIVE, 1, prototype);

    // Copy existing metadata
    const source = prototype;
    const keys = Reflect.getMetadataKeys(source);

    for (const key of keys) {
      const meta = Reflect.getMetadata(key, source);
      Reflect.defineMetadata(key, meta, method);
    }

    return method;
  }

  /**
   * Get all the controllers in the module container.
   */
  private *getControllers(): Generator<InstanceWrapper<Controller>> {
    for (const module of this.modulesContainer.values()) {
      for (const controller of module.controllers.values()) {
        if (controller && controller.metatype?.prototype) {
          yield controller as InstanceWrapper<Controller>;
        }
      }
    }
  }

  /**
   * Get all the providers in the module container.
   */
  private *getProviders(): Generator<InstanceWrapper<InjectableInterface>> {
    for (const module of this.modulesContainer.values()) {
      for (const provider of module.providers.values()) {
        if (provider && provider.metatype?.prototype) {
          yield provider as InstanceWrapper<InjectableInterface>;
        }
      }
    }
  }
}
