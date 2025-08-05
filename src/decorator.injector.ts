import { Injectable, Logger } from '@nestjs/common';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Constants } from './constants';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import {
  Controller,
  Injectable as InjectableInterface,
} from '@nestjs/common/interfaces';
import tracer, { Span } from 'dd-trace';
import { Injector } from './injector.interface';
import { InjectorOptions } from 'src/injector-options.interface';
import { ExceptionFilter } from './exception-filter.types';

@Injectable()
export class DecoratorInjector implements Injector {
  private readonly metadataScanner: MetadataScanner = new MetadataScanner();
  private readonly logger = new Logger();

  // eslint-disable-next-line prettier/prettier
  constructor(private readonly modulesContainer: ModulesContainer) {}

  public inject(options: InjectorOptions) {
    this.injectProviders(
      options.providers,
      new Set(options.excludeProviders),
      options.exceptionFilter,
    );
    this.injectControllers(
      options.controllers,
      new Set(options.excludeControllers),
      options.exceptionFilter,
    );
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
   * Returns whether the prototype is annotated with @NoSpan or not.
   * @param prototype
   * @returns
   */
  private isExcluded(prototype): boolean {
    return Reflect.hasMetadata(Constants.NO_SPAN_METADATA, prototype);
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
   * @param error - The error that occurred (can be any type)
   * @param span - The Datadog span to tag
   * @param filter - Optional exception filter
   * @param spanName - The span name
   * @param methodName - The method name
   */
  private static recordException(
    error: unknown,
    span: Span,
    spanName: string,
    methodName: string,
    filter?: ExceptionFilter,
  ): never {
    if (!filter || filter(error, spanName, methodName)) {
      span.setTag('error', error);
    }

    throw error;
  }

  /**
   * Find providers with span annotation and wrap method.
   */
  private injectProviders(
    injectAll: boolean,
    exclude: Set<string>,
    exceptionFilter?: ExceptionFilter,
  ) {
    const providers = this.getProviders();

    for (const provider of providers) {
      // If no-span annotation is attached to class
      // it and its methods are all excluded
      if (this.isExcluded(provider.metatype)) {
        continue;
      }

      const isExcludedFromInjectAll = exclude.has(provider.name);
      if (injectAll && !isExcludedFromInjectAll) {
        Reflect.defineMetadata(Constants.SPAN_METADATA, 1, provider.metatype);
      }
      const isProviderDecorated = this.isDecorated(provider.metatype);
      const methodNames = this.metadataScanner.getAllFilteredMethodNames(
        provider.metatype.prototype,
      );

      for (const methodName of methodNames) {
        const method = provider.metatype.prototype[methodName];

        // Allready applied or method has been excluded so skip
        if (this.isAffected(method) || this.isExcluded(method)) {
          continue;
        }

        // If span annotation is attached to class, @Span is applied to all methods.
        if (isProviderDecorated || this.isDecorated(method)) {
          const spanName =
            this.getSpanName(method) || `${provider.name}.${methodName}`;
          provider.metatype.prototype[methodName] = this.wrap(
            method,
            spanName,
            exceptionFilter,
            methodName,
          );

          this.logger.log(
            `Mapped ${provider.name}.${methodName}`,
            this.constructor.name,
          );
        }
      }
    }
  }

  /**
   * Find controllers with span annotation and wrap method.
   */
  private injectControllers(
    injectAll: boolean,
    exclude: Set<string>,
    exceptionFilter?: ExceptionFilter,
  ) {
    const controllers = this.getControllers();

    for (const controller of controllers) {
      // If no-span annotation is attached to class
      // it and its methods are all excluded
      if (this.isExcluded(controller.metatype)) {
        continue;
      }

      // Excluded from the injectAll option
      const isExcludedFromInjectAll = exclude.has(controller.name);
      if (injectAll && !isExcludedFromInjectAll) {
        Reflect.defineMetadata(Constants.SPAN_METADATA, 1, controller.metatype);
      }
      const isControllerDecorated = this.isDecorated(controller.metatype);
      const methodNames = this.metadataScanner.getAllFilteredMethodNames(
        controller.metatype.prototype,
      );

      for (const methodName of methodNames) {
        const method = controller.metatype.prototype[methodName];

        // Allready applied or method has been excluded so skip
        if (this.isAffected(method) || this.isExcluded(method)) {
          continue;
        }

        // If span annotation is attached to class, @Span is applied to all methods.
        if (isControllerDecorated || this.isDecorated(method)) {
          const spanName =
            this.getSpanName(method) || `${controller.name}.${methodName}`;
          controller.metatype.prototype[methodName] = this.wrap(
            method,
            spanName,
            exceptionFilter,
            methodName,
          );

          this.logger.log(
            `Mapped ${controller.name}.${methodName}`,
            this.constructor.name,
          );
        }
      }
    }
  }

  /**
   * Wrap the method
   * @param prototype
   * @param spanName
   * @param exceptionFilter
   * @param methodName
   * @returns
   */
  private wrap(
    prototype: Record<string, any>,
    spanName: string,
    exceptionFilter?: ExceptionFilter,
    methodName?: string,
  ) {
    const method = {
      // To keep function.name property
      [prototype.name]: function (...args: any[]) {
        const activeSpan = tracer.scope().active();
        const span = tracer.startSpan(spanName, { childOf: activeSpan });

        return tracer.scope().activate(span, () => {
          if (prototype.constructor.name === 'AsyncFunction') {
            return prototype
              .apply(this, args)
              .catch((error) => {
                DecoratorInjector.recordException(
                  error,
                  span,
                  spanName,
                  methodName,
                  exceptionFilter,
                );
              })
              .finally(() => span.finish());
          } else {
            try {
              const result = prototype.apply(this, args);
              return result;
            } catch (error) {
              DecoratorInjector.recordException(
                error,
                span,
                spanName,
                methodName,
                exceptionFilter,
              );
            } finally {
              span.finish();
            }
          }
        });
      },
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
