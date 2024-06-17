import { EaCDenoKVDatabaseDetails, EaCKeepAliveModifierDetails } from '@fathym/eac';
import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
  FathymAzureContainerCheckPlugin,
  FathymEaCServicesPlugin,
} from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCAzureOpenAILLMDetails,
  EaCDenoKVChatHistoryDetails,
  EaCDenoKVSaverPersistenceDetails,
  EaCMemorySaverPersistenceDetails,
  EaCSynapticCircuitsProcessor,
  EaCTavilySearchResultsToolDetails,
  FathymSynapticPlugin,
} from '@fathym/synaptic';
import { DefaultThinkyProcessorHandlerResolver } from './DefaultThinkyProcessorHandlerResolver.ts';
import ThinkyPlugin from './ThinkyPlugin.ts';

export default class ThinkyRuntimePlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyPlugin',
      Plugins: [
        new FathymAzureContainerCheckPlugin(),
        new FathymEaCServicesPlugin(),
        new ThinkyPlugin(),
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
                Port: config?.Server?.port || 8000,
              },
              dev2: {
                Hostname: '127.0.0.1',
                Port: config?.Server?.port || 8000,
              },
              thinky: {
                Hostname: 'thinky-runtime.fathym.com',
              },
              eacAzure: {
                Hostname: 'thinky-runtime.azurewebsites.net',
              },
            },
            ModifierResolvers: {
              keepAlive: {
                Priority: 5000,
              },
            },
            ApplicationResolvers: {
              circuits: {
                PathPattern: '/circuits*',
                Priority: 100,
                // IsPrivate: true,
              },
            },
          },
        },
        Applications: {
          circuits: {
            Details: {
              Name: 'Circuits',
              Description: 'The API for accessing circuits',
            },
            ModifierResolvers: {},
            Processor: {
              Type: 'SynapticCircuits',
              // Excludes: ['ent-chat:agent', 'ent-chat:action'],
              Includes: ['thinky'],
            } as EaCSynapticCircuitsProcessor,
          },
        },
        Modifiers: {
          keepAlive: {
            Details: {
              Type: 'KeepAlive',
              Name: 'Deno KV Cache',
              Description: 'Lightweight cache to use that stores data in a DenoKV database.',
              KeepAlivePath: '/_eac/alive',
            } as EaCKeepAliveModifierDetails,
          },
        },
        Databases: {
          thinky: {
            Details: {
              Type: 'DenoKV',
              Name: 'Thinky',
              Description: 'The Deno KV database to use for thinky',
              DenoKVPath: Deno.env.get('THINKY_DENO_KV_PATH') || undefined,
            } as EaCDenoKVDatabaseDetails,
          },
        },
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
              'thinky-public:open-chat': {
                Details: {
                  Type: 'DenoKVSaver',
                  DatabaseLookup: 'thinky',
                  RootKey: ['Thinky', 'Public', 'Open', 'Chat'],
                  CheckpointTTL: 1 * 1000 * 60 * 60 * 24 * 7, // 7 Days
                } as EaCDenoKVSaverPersistenceDetails,
              },
              'thinky-public': {
                Details: {
                  Type: 'DenoKVSaver',
                  DatabaseLookup: 'thinky',
                  RootKey: ['Thinky', 'Public'],
                  CheckpointTTL: 1 * 1000 * 60 * 60 * 24 * 7, // 7 Days
                } as EaCDenoKVSaverPersistenceDetails,
              },
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
      },
      IoC: new IoCContainer(),
    };

    pluginConfig.IoC!.Register(DefaultThinkyProcessorHandlerResolver, {
      Type: pluginConfig.IoC!.Symbol('ProcessorHandlerResolver'),
    });

    return Promise.resolve(pluginConfig);
  }
}
