// deno-lint-ignore-file no-explicit-any
import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import { EaCLLMNeuron } from '@fathym/synaptic';
import MinervaPlugin from './thinky/MinervaPlugin.ts';
import ThinkyEnterprisePlugin from './thinky/ThinkyEnterprisePlugin.ts';
import ThinkyPublicPlugin from './thinky/ThinkyPublicPlugin.ts';

export default class ThinkyPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyPlugin',
      Plugins: [
        new ThinkyPublicPlugin(),
        new ThinkyEnterprisePlugin(),
        new MinervaPlugin(),
      ],
      EaC: {
        Circuits: {
          $neurons: {
            'thinky-llm': {
              Type: 'LLM',
              LLMLookup: `thinky|thinky`,
            } as EaCLLMNeuron as any,
            'thinky-llm-tooled': {
              Type: 'LLM',
              LLMLookup: `thinky|thinky-tooled`,
            } as EaCLLMNeuron as any,
          },
          $remotes: {
            // 'remote-test': 'http://localhost:6131/circuits/'
          },
        },
      },
      IoC: new IoCContainer(),
    };

    return Promise.resolve(pluginConfig);
  }
}
