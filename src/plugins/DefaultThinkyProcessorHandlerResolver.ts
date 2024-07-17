import {
  DefaultProcessorHandlerResolver,
  EaCApplicationProcessorConfig,
  EaCRuntimeEaC,
  ProcessorHandlerResolver,
} from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import { DefaultSynapticProcessorHandlerResolver } from '@fathym/synaptic';
import { DefaultMSALProcessorHandlerResolver } from '@fathym/msal';

export class DefaultThinkyProcessorHandlerResolver implements ProcessorHandlerResolver {
  public async Resolve(
    ioc: IoCContainer,
    appProcCfg: EaCApplicationProcessorConfig,
    eac: EaCRuntimeEaC,
  ) {
    const synapticResolver = new DefaultSynapticProcessorHandlerResolver();

    let resolver = await synapticResolver.Resolve(ioc, appProcCfg, eac);

    if (!resolver) {
      const defaultResolver = new DefaultMSALProcessorHandlerResolver();

      resolver = await defaultResolver.Resolve(ioc, appProcCfg, eac);
    }

    if (!resolver) {
      const defaultResolver = new DefaultProcessorHandlerResolver();

      resolver = await defaultResolver.Resolve(ioc, appProcCfg, eac);
    }

    return resolver;
  }
}
