import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac-runtime';
import { EaCCircuitNeuron } from '@fathym/synaptic';
import { FathymEaCStatusPlugin } from './future_remotes/FathymEaCStatusPlugin.ts';
import AzureSubscriptionsPlugin from './future_remotes/azure/AzureSubscriptionsPlugin.ts';
import AzureConnectPlugin from './future_remotes/azure/AzureConnectPlugin.ts';

export class FathymEaCRemotesPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: FathymEaCRemotesPlugin.name,
      Plugins: [
        new FathymEaCStatusPlugin(),
        new AzureSubscriptionsPlugin(),
        new AzureConnectPlugin(),
      ],
      EaC: {
        Circuits: {
          $remotes: {
            // 'fathym|azure|utils': 'http://localhost:6151/circuits/',
            // 'thinky|eac|utils': 'http://localhost:6152/circuits/',
          },
          $neurons: {
            [`${FathymEaCRemotesPlugin.name}|cloud|azure-connect`]: {
              Type: 'Circuit',
              CircuitLookup: `${AzureConnectPlugin.name}|cloud|azure-connect`,
              BootstrapInput(s, _, cfg) {
                cfg!.configurable.RuntimeContext = JSON.stringify(
                  cfg!.configurable.RuntimeContext,
                );

                return s;
              },
              // BootstrapOutput(s, _, cfg) {
              //   cfg!.configurable.RuntimeContext = JSON.parse(
              //     cfg!.configurable.RuntimeContext
              //   );

              //   return s;
              // },
            } as EaCCircuitNeuron,
            [`${FathymEaCRemotesPlugin.name}|wait-for-status`]: {
              Type: 'Circuit',
              CircuitLookup: `${FathymEaCStatusPlugin.name}|wait-for-status`,
              BootstrapInput(s, _, cfg) {
                cfg!.configurable.RuntimeContext = JSON.stringify(
                  cfg!.configurable.RuntimeContext,
                );

                return s;
              },
              // BootstrapOutput(s, _, cfg) {
              //   cfg!.configurable.RuntimeContext = JSON.parse(
              //     cfg!.configurable.RuntimeContext
              //   );

              //   return s;
              // },
            } as EaCCircuitNeuron,
          },
        },
      },
    };

    return Promise.resolve(pluginConfig);
  }
}
