import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
  FathymAzureContainerCheckPlugin,
} from '@fathym/eac/runtime';
import { FathymSynapticPlugin } from '@fathym/synaptic';
import { IoCContainer } from '@fathym/ioc';
import { DefaultThinkyProcessorHandlerResolver } from './DefaultThinkyProcessorHandlerResolver.ts';

export default class ThinkyPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyPlugin',
      Plugins: [
        new FathymAzureContainerCheckPlugin(),
        new FathymSynapticPlugin(),
      ],
      EaC: {
        Projects: {
          thinky: {
            Details: {
              Name: 'Thinky',
              Description: 'The Thinky AI logic and APIs.',
              Priority: 100,
            },
            ResolverConfigs: {
              dev: {
                Hostname: 'localhost',
                Port: config.Server.port || 8000,
              },
              dev2: {
                Hostname: '127.0.0.1',
                Port: config.Server.port || 8000,
              },
              thinky: {
                Hostname: 'thinky-runtime.fathym.com',
              },
              eacAzure: {
                Hostname: 'thinky-runtime.azurewebsites.net',
              },
            },
            ModifierResolvers: {},
            ApplicationResolvers: {},
          },
        },
      },
      IoC: new IoCContainer(),
    };

    pluginConfig.IoC!.Register(DefaultThinkyProcessorHandlerResolver, {
      Type: pluginConfig.IoC!.Symbol('ProcessorHandlerResolver'),
    });

    return Promise.resolve(pluginConfig);
  }
}
