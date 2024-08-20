import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
} from '@fathym/eac-runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCAzureOpenAILLMDetails,
  EaCDenoKVChatHistoryDetails,
  EaCLLMNeuron,
  EaCMemorySaverPersistenceDetails,
  EaCPassthroughNeuron,
  EaCTavilySearchResultsToolDetails,
  EaCToolNeuron,
} from '@fathym/synaptic';
import MinervaPlugin from './thinky/MinervaPlugin.ts';
import ThinkyEnterprisePlugin from './thinky/ThinkyEnterprisePlugin.ts';
import ThinkyPublicPlugin from './thinky/ThinkyPublicPlugin.ts';
import ThinkyDashboardPlugin from './thinky/ThinkyDashboardPlugin.ts';
import { FathymEaCRemotesPlugin } from './thinky/FathymEaCRemotesPlugin.ts';

export default class ThinkyPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyPlugin',
      Plugins: [
        new FathymEaCRemotesPlugin(),
        new ThinkyPublicPlugin(),
        new ThinkyDashboardPlugin(),
        new ThinkyEnterprisePlugin(),
        new MinervaPlugin(),
      ],
      EaC: {
        AIs: {
          thinky: {
            ChatHistories: {
              tester: {
                Details: {
                  Type: 'DenoKV',
                  Name: 'Thinky',
                  Description: 'The Thinky document indexer to use.',
                  DenoKVDatabaseLookup: 'thinky',
                  RootKey: ['Thinky', 'EaC', 'ChatHistory', 'Tester'],
                } as EaCDenoKVChatHistoryDetails,
              },
            },
            LLMs: {
              thinky: {
                Details: {
                  Type: 'AzureOpenAI',
                  Name: 'Azure OpenAI LLM',
                  Description: 'The LLM for interacting with Azure OpenAI.',
                  APIKey: Deno.env.get('AZURE_OPENAI_KEY')!,
                  Endpoint: Deno.env.get('AZURE_OPENAI_ENDPOINT')!,
                  DeploymentName: 'gpt-4o',
                  ModelName: 'gpt-4o',
                  Streaming: true,
                  Verbose: false,
                } as EaCAzureOpenAILLMDetails,
              },
              'thinky-tooled': {
                Details: {
                  Type: 'AzureOpenAI',
                  Name: 'Azure OpenAI LLM',
                  Description: 'The LLM for interacting with Azure OpenAI.',
                  APIKey: Deno.env.get('AZURE_OPENAI_KEY')!,
                  Endpoint: Deno.env.get('AZURE_OPENAI_ENDPOINT')!,
                  DeploymentName: 'gpt-4o',
                  ModelName: 'gpt-4o',
                  Streaming: true,
                  Verbose: false,
                  ToolLookups: ['thinky|tavily'],
                } as EaCAzureOpenAILLMDetails,
              },
            },
            Persistence: {
              memory: {
                Details: {
                  Type: 'MemorySaver',
                } as EaCMemorySaverPersistenceDetails,
              },
            },
            Tools: {
              tavily: {
                Details: {
                  Type: 'TavilySearchResults',
                  APIKey: Deno.env.get('TAVILY_API_KEY')!,
                } as EaCTavilySearchResultsToolDetails,
              },
            },
          },
        },
        Circuits: {
          $neurons: {
            $pass: {
              Type: 'Passthrough',
            } as EaCPassthroughNeuron,
            'thinky-llm': {
              Type: 'LLM',
              LLMLookup: `thinky|thinky`,
            } as EaCLLMNeuron,
            'thinky-llm-tooled': {
              Type: 'LLM',
              LLMLookup: `thinky|thinky-tooled`,
            } as EaCLLMNeuron,
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
