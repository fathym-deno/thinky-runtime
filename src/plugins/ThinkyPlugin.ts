import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCAzureOpenAILLMDetails,
  EaCDenoKVChatHistoryDetails,
  EaCDynamicToolDetails,
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
import z from 'npm:zod';
import { loadEaCAzureSvc } from '@fathym/eac/api';
import { EaCESMDistributedFileSystem } from '@fathym/eac';

export const FathymAzureBillingAccountsInputSchema = z.object({});

export type FathymAzureBillingAccountsInputSchema = z.infer<
  typeof FathymAzureBillingAccountsInputSchema
>;

export const FathymAzureSubscriptionsInputSchema = z.object({});

export type FathymAzureSubscriptionsInputSchema = z.infer<
  typeof FathymAzureSubscriptionsInputSchema
>;

export const FathymAzureTenantsInputSchema = z.object({});

export type FathymAzureTenantsInputSchema = z.infer<
  typeof FathymAzureTenantsInputSchema
>;

export default class ThinkyPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyPlugin',
      Plugins: [
        new ThinkyPublicPlugin(),
        new ThinkyDashboardPlugin(),
        new ThinkyEnterprisePlugin(),
        new MinervaPlugin(),
      ],
      EaC: {
        // DFS: {
        //   'fathym-synaptic-resolvers': {
        //     Type: 'ESM',
        //     Root: '@fathym/synaptic/',
        //     EntryPoints: ['resolvers.ts'],
        //     IncludeDependencies: false,
        //   } as EaCESMDistributedFileSystem,
        // },
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
              'fathym:azure:billing-accounts': {
                Details: {
                  Type: 'Dynamic',
                  Name: 'fathym-azure-billing-accounts',
                  Description:
                    "Use this tool to retrieve the user's current Azure billing accounts.",
                  Schema: FathymAzureBillingAccountsInputSchema,
                  Action: async (
                    _input: FathymAzureBillingAccountsInputSchema,
                    _,
                    cfg,
                  ) => {
                    const state = cfg!.configurable!.RuntimeContext.State;

                    const entLookup = state.EnterpriseLookup as string;

                    const jwt = state.JWT as string;

                    const eacAzureSvc = await loadEaCAzureSvc(jwt);

                    try {
                      const billingAccounts = await eacAzureSvc.BillingAccounts(
                        entLookup,
                        state.GettingStarted.AzureAccessToken,
                      );

                      const billingAcctDetails = billingAccounts.reduce(
                        (acc, billingAccount) => {
                          const [id, displayName] = [
                            billingAccount.id!,
                            billingAccount.displayName,
                          ];

                          switch (billingAccount.agreementType!) {
                            case 'MicrosoftOnlineServicesProgram': {
                              acc[id] = `MOSP - ${displayName}`;
                              break;
                            }

                            case 'MicrosoftCustomerAgreement': {
                              const billingProfiles = billingAccount.billingProfiles?.value || [];

                              billingProfiles.forEach((billingProfile) => {
                                const invoiceSections = billingProfile.invoiceSections?.value || [];

                                invoiceSections.forEach((invoiceSection) => {
                                  acc[
                                    invoiceSection.id!
                                  ] =
                                    `MCA - ${displayName} - Profile - ${billingProfile.displayName} - Invoice - ${invoiceSection.displayName}`;
                                });
                              });
                              break;
                            }

                            case 'MicrosoftPartnerAgreement': {
                              // TODO(mcgear): Add support for Partner Agreement Flows
                              // https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/programmatically-create-subscription-microsoft-partner-agreement?tabs=rest#find-customers-that-have-azure-plans
                              // acc[id] = displayName;
                              break;
                            }

                            case 'EnterpriseAgreement': {
                              const enrollmentAccounts = billingAccount.enrollmentAccounts || [];

                              enrollmentAccounts.forEach((account) => {
                                acc[
                                  account.id!
                                ] = `EA - ${displayName} - Enrollment - ${account.accountName}`;
                              });
                              break;
                            }
                          }

                          return acc;
                        },
                        {} as Record<string, string>,
                      );

                      return JSON.stringify(billingAcctDetails);
                    } catch (ex) {
                      return JSON.stringify(ex);
                    }
                  },
                } as EaCDynamicToolDetails,
              },
              'fathym:azure:subscriptions': {
                Details: {
                  Type: 'Dynamic',
                  Name: 'fathym-azure-subscriptions',
                  Description: "Use this tool to retrieve the user's current Azure subscriptions.",
                  Schema: FathymAzureSubscriptionsInputSchema,
                  Action: async (
                    _input: FathymAzureSubscriptionsInputSchema,
                    _,
                    cfg,
                  ) => {
                    const state = cfg!.configurable!.RuntimeContext.State;

                    const entLookup = state.EnterpriseLookup as string;

                    const jwt = state.JWT as string;

                    const eacAzureSvc = await loadEaCAzureSvc(jwt);

                    try {
                      const subs = await eacAzureSvc.Subscriptions(
                        entLookup,
                        state.GettingStarted.AzureAccessToken,
                      );

                      const subDetails = subs.reduce((acc, sub) => {
                        acc[sub.subscriptionId!] = sub.displayName!;

                        return acc;
                      }, {} as Record<string, string>);

                      return JSON.stringify(subDetails);
                    } catch (ex) {
                      return JSON.stringify(ex);
                    }
                  },
                } as EaCDynamicToolDetails,
              },
              'fathym:azure:tenants': {
                Details: {
                  Type: 'Dynamic',
                  Name: 'fathym-azure-tenants',
                  Description: "Use this tool to retrieve the user's current Azure tenants.",
                  Schema: FathymAzureTenantsInputSchema,
                  Action: async (
                    _input: FathymAzureTenantsInputSchema,
                    _,
                    cfg,
                  ) => {
                    const state = cfg!.configurable!.RuntimeContext.State;

                    const entLookup = state.EnterpriseLookup as string;

                    const jwt = state.JWT as string;

                    const eacAzureSvc = await loadEaCAzureSvc(jwt);

                    try {
                      const tenants = await eacAzureSvc.Tenants(
                        entLookup,
                        state.GettingStarted.AzureAccessToken,
                      );

                      const tenantDetails = tenants.reduce((acc, tenant) => {
                        acc[tenant.tenantId!] = tenant.displayName!;

                        return acc;
                      }, {} as Record<string, string>);

                      return JSON.stringify(tenantDetails);
                    } catch (ex) {
                      return JSON.stringify(ex);
                    }
                  },
                } as EaCDynamicToolDetails,
              },
            },
          },
        },
        Circuits: {
          // $handlers: ['fathym-synaptic-resolvers'],
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
            'fathym:azure:billing-accounts': {
              Type: 'Tool',
              ToolLookup: 'thinky|fathym:azure:billing-accounts',
            } as EaCToolNeuron,
            'fathym:azure:subscriptions': {
              Type: 'Tool',
              ToolLookup: 'thinky|fathym:azure:subscriptions',
            } as EaCToolNeuron,
            'fathym:azure:tenants': {
              Type: 'Tool',
              ToolLookup: 'thinky|fathym:azure:tenants',
            } as EaCToolNeuron,
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
