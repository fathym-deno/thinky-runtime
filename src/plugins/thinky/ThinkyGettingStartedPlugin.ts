import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
} from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCChatPromptNeuron,
  EaCCircuitNeuron,
  EaCDenoKVSaverPersistenceDetails,
  EaCDynamicToolDetails,
  EaCGraphCircuitDetails,
  EaCLLMNeuron,
  EaCLinearCircuitDetails,
  EaCNeuron,
  EaCToolNeuron,
  InferSynapticState,
  TypeToZod,
} from '@fathym/synaptic';
import z from 'npm:zod';
import { MessagesPlaceholder } from 'npm:@langchain/core/prompts';
import { BaseMessagePromptTemplateLike } from 'npm:@langchain/core/prompts';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  FunctionMessage,
  HumanMessage,
  HumanMessageChunk,
} from 'npm:@langchain/core/messages';
import { END, START } from 'npm:@langchain/langgraph';
import { RunnableLambda } from 'npm:@langchain/core/runnables';
import { ThinkyGettingStartedState } from '../DefaultThinkyModifierHandlerResolver.ts';
import {
  EaCStatus,
  FathymEaC,
  loadEaCSvc,
  waitForStatus,
} from '@fathym/eac/api';
import {
  EaCCloudAzureDetails,
  EaCCloudResourceFormatDetails,
} from '@fathym/eac';
import { FathymEaCStatusPlugin } from './FathymEaCStatusPlugin.ts';

export const ThinkyGettingStartedCircuitInputSchema = z.object({
  Input: z.string().optional(),
});

export type ThinkyGettingStartedCircuitInputSchema = z.infer<
  typeof ThinkyGettingStartedCircuitInputSchema
>;

export const ThinkyGettingStartedGraphStateSchema = {
  HasAzureAccessToken: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  HasConfiguredCalz: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  HasConfiguredCloud: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  Messages: {
    value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  },
};

export type ThinkyGettingStartedGraphStateSchema = InferSynapticState<
  typeof ThinkyGettingStartedGraphStateSchema
>;

export const ThinkyGettingStartedStateSchema =
  z.custom<ThinkyGettingStartedGraphStateSchema>();

export const CloudCALZGraphState = {
  CALZCreated: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  Confirmed: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  Messages: {
    value: (x?: BaseMessage[], y?: BaseMessage[]) => x?.concat(y || []),
    default: () => [],
  },
  ResourceGroupLookup: {
    value: (_x: string, y: string) => y,
    default: () => '',
  },
};

export type CloudCALZGraphState = InferSynapticState<
  typeof CloudCALZGraphState
>;

export const CloudCALZSchema = z.object({
  Confirmed: z
    .boolean()
    .optional()
    .describe(
      'This value should be set to true, only once a user has explicitly confirmed their selections for `ResourceGroupLookup`, and that the `ResourceGroupLookup` is in alphanumeric, lowered snake-case (with hyphens (-)) format.'
    ),
  ResourceGroupLookup: z
    .string()
    .optional()
    .describe(
      'This is the unique lookup/name that a user can choose for their cloud resource group, and must be in alphanumeric, lowered snake-case (with hyphens (-)) to work.'
    ),
} as TypeToZod<Omit<CloudCALZGraphState, 'CALZCreated' | 'Messages'>>);

export type CloudCALZSchema = z.infer<typeof CloudCALZSchema>;

export const AzureConnectGraphState = {
  BillingAccount: {
    value: (_x: string, y: string) => y,
    default: () => '',
  },
  CloudConnected: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  Messages: {
    value: (x?: BaseMessage[], y?: BaseMessage[]) => x?.concat(y || []),
    default: () => [],
  },
  SubscriptionName: {
    value: (_x: string, y: string) => y,
    default: () => '',
  },
  SubscriptionID: {
    value: (_x: string, y: string) => y,
    default: () => '',
  },
  Verified: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
};

export type AzureConnectGraphState = InferSynapticState<
  typeof AzureConnectGraphState
>;

export const AzureConnectSchema = z.object({
  BillingAccount: z
    .string()
    .optional()
    .describe(
      'This value should only be set when creating a new subscription, and should not be defined when using an existing `SubscriptionID`.'
    ),
  SubscriptionName: z
    .string()
    .optional()
    .describe(
      'This value should only be set when creating a new subscription, and should not be defined when using an existing `SubscriptionID`.'
    ),
  SubscriptionID: z
    .string()
    .optional()
    .describe(
      'This value should only be set when using an existing subscription, and should not be defined when creating with a new `SubscriptionName`.'
    ),
  Verified: z
    .boolean()
    .optional()
    .describe(
      'This value should be set to true, only once a user has explicitly confirmed their selections for (`SubscriptionName` and `BillingAccount`) or `SubscriptionID`.'
    ),
} as TypeToZod<Omit<AzureConnectGraphState, 'CloudConnected' | 'LastAzureAccessToken' | 'Messages'>>);

export type AzureConnectSchema = z.infer<typeof AzureConnectSchema>;

export default class ThinkyGettingStartedPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyGettingStartedPlugin',
      Plugins: [new FathymEaCStatusPlugin()],
      EaC: {
        $neurons: {},
        AIs: {
          thinky: {
            Persistence: {
              'thinky-getting-started': {
                Details: {
                  Type: 'DenoKVSaver',
                  DatabaseLookup: 'thinky',
                  RootKey: ['Thinky', 'Dashboard', 'GettingStarted'],
                  CheckpointTTL: 1 * 1000 * 60 * 60 * 24 * 7, // 7 Days
                } as EaCDenoKVSaverPersistenceDetails,
              },
            },
            Tools: {
              'thinky-getting-started:cloud-azure-connect': {
                Details: {
                  Type: 'Dynamic',
                  Name: 'cloud-azure-connect',
                  Description:
                    "Use this tool to create connect a user's Azure subscription when they confirm that they are ready to connect it.",
                  Schema: AzureConnectSchema,
                  Action: async (input: AzureConnectSchema, _, cfg) => {
                    const state = cfg!.configurable!.RuntimeContext.State;

                    const jwt = state.JWT as string;

                    const cloudLookup = crypto.randomUUID();

                    const commitEaC: FathymEaC = {
                      EnterpriseLookup: state.EnterpriseLookup,
                      Clouds: {
                        [cloudLookup]: {
                          // TODO(mcgear): Get stored Azure token
                          Token: state.GettingStarted.AzureAccessToken,
                          Details: {
                            Type: 'Azure',
                            Name: input.SubscriptionName,
                            SubscriptionID: input.SubscriptionID,
                            BillingScope: input.BillingAccount,
                          } as EaCCloudAzureDetails & { BillingScope: string },
                        },
                      },
                    };

                    try {
                      const eacSvc = await loadEaCSvc(jwt);

                      const commitResp = await eacSvc.Commit(commitEaC, 60);

                      const status = await eacSvc.Status(
                        commitResp.EnterpriseLookup,
                        commitResp.CommitID
                      );

                      return JSON.stringify(status);
                    } catch (ex) {
                      return JSON.stringify(ex);
                    }
                  },
                } as EaCDynamicToolDetails,
              },
              'thinky-getting-started:calz': {
                Details: {
                  Type: 'Dynamic',
                  Name: 'calz',
                  Description:
                    'Use this tool to commit an initial CALZ definition to a resource group for the user.',
                  Schema: CloudCALZSchema,
                  Action: async (input: CloudCALZSchema, _, cfg) => {
                    const state = cfg!.configurable!.RuntimeContext.State;

                    const jwt = state.JWT as string;

                    const cloudLookup = Object.keys(state.EaC!.Clouds || {})[0];

                    const resGroupLookup = input.ResourceGroupLookup;

                    const resGroupLocation = 'West US 2';

                    const resLookup = 'calz';

                    const shortName = resGroupLookup
                      .split('-')
                      .map((p) => p.charAt(0))
                      .join('');

                    const details = state.EaC!.Clouds![cloudLookup]
                      .Details as EaCCloudAzureDetails;

                    const servicePrincipalId = details!.ID;

                    const commitEaC: FathymEaC = {
                      EnterpriseLookup: state.EnterpriseLookup,
                      Clouds: {
                        [cloudLookup]: {
                          ResourceGroups: {
                            [resGroupLookup]: {
                              Details: {
                                Name: resGroupLookup,
                                Description: resGroupLookup,
                                Location: resGroupLocation,
                                Order: 1,
                              },
                              Resources: {
                                [resLookup]: {
                                  Details: {
                                    Type: 'Format',
                                    Name: 'Core CALZ',
                                    Description:
                                      'The core CALZ to use for the enterprise.',
                                    Order: 1,
                                    Template: {
                                      Content:
                                        'https://raw.githubusercontent.com/lowcodeunit/infrastructure/master/templates/eac/calz/template.jsonc',
                                      Parameters:
                                        'https://raw.githubusercontent.com/lowcodeunit/infrastructure/master/templates/eac/calz/parameters.jsonc',
                                    },
                                    Data: {
                                      CloudLookup: cloudLookup,
                                      Location: resGroupLocation,
                                      Name: resGroupLookup,
                                      PrincipalID: '', // TODO(mcgear): Pass in actual principal ID (maybe retrievable from MSAL account record? I think can just be the email?)
                                      ResourceLookup: resLookup,
                                      ServicePrincipalID: servicePrincipalId,
                                      ShortName: shortName,
                                    },
                                    Outputs: {},
                                  } as EaCCloudResourceFormatDetails,
                                },
                              },
                            },
                          },
                        },
                      },
                    };

                    try {
                      const eacSvc = await loadEaCSvc(jwt);

                      const commitResp = await eacSvc.Commit(commitEaC, 60);

                      const status = await eacSvc.Status(
                        commitResp.EnterpriseLookup,
                        commitResp.CommitID
                      );

                      return JSON.stringify(status);
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
          $neurons: {
            'thinky-getting-started:tools:cloud:azure-connect': {
              Type: 'Tool',
              ToolLookup: 'thinky|thinky-getting-started:cloud-azure-connect',
              Bootstrap: (r) =>
                r.pipe(
                  RunnableLambda.from((toolRes: string) => {
                    return { Status: JSON.parse(toolRes) };
                  })
                ),
            } as EaCToolNeuron,
            'thinky-getting-started:tools:cloud:calz': {
              Type: 'Tool',
              ToolLookup: 'thinky|thinky-getting-started:calz',
              Bootstrap: (r) =>
                r.pipe(
                  RunnableLambda.from((toolRes: string) => {
                    return { Status: JSON.parse(toolRes) };
                  })
                ),
            } as EaCToolNeuron,
          },
          'thinky-getting-started:cloud:azure-connect:subscriptions':
            this.buildCloudAzureConnectSubscriptionsCircuit(),
          'thinky-getting-started:cloud:azure-connect':
            this.buildCloudAzureConnectCircuit(),
          'thinky-getting-started:cloud:calz:resource-group':
            this.buildCloudCALZResourceGroupCircuit(),
          'thinky-getting-started:cloud:calz': this.buildCloudCALZCircuit(),
          'thinky-getting-started:cloud': this.buildCloudCircuit(),
          'thinky-getting-started': this.buildGettingStartedCircuit(),
        },
      },
      IoC: new IoCContainer(),
    };

    return Promise.resolve(pluginConfig);
  }

  protected buildCloudCircuit() {
    return {
      Details: {
        Type: 'Graph',
        Priority: 100,
        State: ThinkyGettingStartedGraphStateSchema,
        Neurons: {
          'azure-connect': {
            Type: 'Circuit',
            CircuitLookup: 'thinky-getting-started:cloud:azure-connect',
          } as EaCCircuitNeuron,
          calz: {
            Type: 'Circuit',
            CircuitLookup: 'thinky-getting-started:cloud:calz',
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from(
                  (state: ThinkyGettingStartedGraphStateSchema, cfg) => {
                    const gettingStarted: ThinkyGettingStartedState =
                      cfg?.configurable?.RuntimeContext.State.GettingStarted;

                    return {
                      ...state,
                      Messages: !gettingStarted.CurrentCloud
                        ? [state.Messages.slice(-1)[0]]
                        : state.Messages,
                    };
                  }
                )
              ),
          } as EaCCircuitNeuron,
        },
        Edges: {
          [START]: {
            Node: {
              'azure-connect': 'azure-connect',
              calz: 'calz',
              [END]: END,
            },
            Condition: (_, cfg) => {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return gettingStarted.CurrentCALZ
                ? END
                : gettingStarted.CurrentCloud
                ? 'calz'
                : 'azure-connect';
            },
          },
          'azure-connect': {
            Node: {
              calz: 'calz',
              [END]: END,
            },
            Condition: (state: ThinkyGettingStartedGraphStateSchema, cfg) => {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return state.HasConfiguredCloud && !gettingStarted.CurrentCloud
                ? 'calz'
                : END;
            },
          },
          calz: END,
        },
        Bootstrap: (r) =>
          r.pipe(
            RunnableLambda.from(
              (state: ThinkyGettingStartedGraphStateSchema) => {
                const lastAiMsgs = lastAiNotHumanMessages(state.Messages);

                return {
                  ...state,
                  Messages: lastAiMsgs,
                };
              }
            )
          ),
      } as EaCGraphCircuitDetails,
    };
  }

  protected buildCloudAzureConnectCircuit() {
    return {
      Details: {
        Type: 'Graph',
        Priority: 100,
        InputSchema: AzureConnectSchema,
        State: AzureConnectGraphState,
        Neurons: {
          'azure-login': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant. Right now, your only job is to get the user connected with Azure. You should be friendly, end inspire confidence in the user, so they click. We need to link the user to \`/dashboard/thinky/connect/azure/signin?success_url=/dashboard/getting-started\`. It has to be that exact, absolute path, with no host/origin. Provide your response as Markdown, without any titles, just your responses as markdown. Markdwon example would be \`[...]('/dashboard/thinky/connect/azure/signin?success_url=/dashboard/getting-started')\``,
            NewMessages: [
              new HumanMessage('Hi'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((msg: BaseMessage, cfg) => {
                  return {
                    Messages: [msg],
                  } as AzureConnectGraphState;
                })
              ),
          } as EaCChatPromptNeuron,
          'azure-sub': {
            Type: 'Circuit',
            CircuitLookup:
              'thinky-getting-started:cloud:azure-connect:subscriptions',
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((state: AzureConnectGraphState, cfg) => {
                  return {
                    ...state,
                    Messages: state.Messages?.length
                      ? [state.Messages.slice(-1)[0]]
                      : [],
                  } as AzureConnectGraphState;
                })
              ),
          } as EaCCircuitNeuron,
          'azure-sub-commit:message': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant.  Let the user know that you are storing their azure connection information, and you'll be back with them shortly once complete.`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((msg: BaseMessage, cfg) => {
                  return {
                    Messages: [msg],
                  } as AzureConnectGraphState;
                })
              ),
          } as EaCChatPromptNeuron,
          'azure-sub-commit:tool': {
            Neurons: {
              '': 'thinky-getting-started:tools:cloud:azure-connect',
            },
            Synapses: {
              '': [
                'fathym:eac:wait-for-status',
                {
                  Bootstrap: (r) =>
                    RunnableLambda.from(({ Status }: { Status: EaCStatus }) => {
                      return {
                        Status,
                        Operation: 'Connecting User to Azure',
                      };
                    }).pipe(r),
                } as Partial<EaCNeuron>,
              ],
            },
            Bootstrap: (r) =>
              RunnableLambda.from((state: AzureConnectGraphState) => {
                return {
                  BillingAccount: state.BillingAccount ?? undefined,
                  SubscriptionID: state.SubscriptionID ?? undefined,
                  SubscriptionName: state.SubscriptionName ?? undefined,
                  Verified: state.Verified || false,
                } as AzureConnectSchema;
              })
                .pipe(r)
                .pipe(
                  RunnableLambda.from(
                    ({ Status }: { Status: EaCStatus }, cfg) => {
                      return {
                        Messages: [
                          new FunctionMessage({
                            content: JSON.stringify(Status),
                            name: 'cloud-azure-connect',
                          }),
                        ],
                      };
                    }
                  )
                ),
          } as Partial<EaCNeuron>,
          'azure-sub:complete': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant.  Let the user know that you have completed storing their Azure connection information and that you are analyzing next steps, and will be back with them shortly.`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((msg: BaseMessage, cfg) => {
                  return {
                    CloudConnected: true,
                    Messages: [msg],
                  } as AzureConnectGraphState;
                })
              ),
          } as EaCChatPromptNeuron,
        },
        Edges: {
          [START]: {
            Node: {
              login: 'azure-login',
              sub: 'azure-sub',
            },
            Condition: (_, cfg) => {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return gettingStarted.AzureAccessToken ? 'sub' : 'login';
            },
          },
          'azure-login': END,
          'azure-sub': {
            Node: {
              message: 'azure-sub-commit:message',
              tool: 'azure-sub-commit:tool',
              [END]: END,
            },
            Condition: (state: AzureConnectGraphState, cfg) => {
              if (
                state.Verified &&
                (state.SubscriptionID ||
                  (state.SubscriptionName && state.BillingAccount))
              ) {
                return ['message', 'tool'];
              }
              return END;
            },
          },
          'azure-sub-commit:message': 'azure-sub:complete',
          'azure-sub-commit:tool': 'azure-sub:complete',
          'azure-sub:complete': END,
        },
        Bootstrap: (r) =>
          r.pipe(
            RunnableLambda.from(
              ({ CloudConnected, Messages }: AzureConnectGraphState, cfg) => {
                const lastAiMsgs = lastAiNotHumanMessages(Messages);

                return {
                  HasConfiguredCloud: CloudConnected,
                  Messages: lastAiMsgs,
                } as ThinkyGettingStartedGraphStateSchema;
              }
            )
          ),
      } as EaCGraphCircuitDetails,
    };
  }

  protected buildCloudAzureConnectSubscriptionsCircuit() {
    return {
      Details: {
        Type: 'Linear',
        Priority: 100,
        Neurons: {
          BillingAccounts: 'fathym:azure:billing-accounts',
          Subscriptions: 'fathym:azure:subscriptions',
          State: '$pass',
        },
        Synapses: {
          '': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant. Let the user know that you are here to help them connect their Azure Subscription. They can select an existing subscription, or provide a name for a new subscription to continue. Once picking a new name, they will have to select a Billing Account. Favor showing the user the name of existing resources, and be short and concise in your responses. Start with subscription information, and only ask about/show billing account information if creating a new subscription. Do your best to talk the user through getting their subscription information, and make sure that you get the user to confirm their subscription information before calling the tool. Once the user has confirmed their subscription, you can call the tool.
  
Existing Subscriptions (JSON Format with key 'ID' and value 'Name'):
{Subscriptions}  

Existing Billing Accounts (JSON Format with key 'ID' and value 'Name'):
{BillingAccounts}        
`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': [
                'thinky-llm',
                {
                  ToolsAsFunctions: true,
                  ToolLookups: [
                    'thinky|thinky-getting-started:cloud-azure-connect',
                  ],
                } as Partial<EaCLLMNeuron>,
              ],
            },
            Bootstrap: (r) =>
              RunnableLambda.from(
                ({
                  Subscriptions,
                  BillingAccounts,
                  State,
                }: {
                  Subscriptions: string;
                  BillingAccounts: string;
                  State: AzureConnectGraphState;
                }) => {
                  return {
                    ...State,
                    Subscriptions,
                    BillingAccounts,
                  };
                }
              )
                .pipe(r)
                .pipe(
                  RunnableLambda.from((msg: BaseMessage, cfg) => {
                    if (msg.additional_kwargs.tool_calls?.length) {
                      const tool =
                        msg.additional_kwargs.tool_calls![0].function;

                      const toolArgs = JSON.parse(
                        tool.arguments
                      ) as AzureConnectSchema;

                      return {
                        Messages: undefined,
                        BillingAccount: toolArgs.BillingAccount,
                        SubscriptionID: toolArgs.SubscriptionID,
                        SubscriptionName: toolArgs.SubscriptionName,
                        Verified: toolArgs.Verified,
                      } as AzureConnectGraphState;
                    } else if (msg.additional_kwargs.function_call) {
                      const tool = msg.additional_kwargs.function_call;

                      const toolArgs = JSON.parse(
                        tool.arguments
                      ) as AzureConnectSchema;

                      return {
                        Messages: undefined,
                        BillingAccount: toolArgs.BillingAccount,
                        SubscriptionID: toolArgs.SubscriptionID,
                        SubscriptionName: toolArgs.SubscriptionName,
                        Verified: toolArgs.Verified,
                      } as AzureConnectGraphState;
                    } else {
                      return {
                        Messages: [msg],
                      } as AzureConnectGraphState;
                    }
                  })
                ),
          } as EaCChatPromptNeuron,
        },
      } as EaCLinearCircuitDetails,
    };
  }

  protected buildCloudCALZCircuit() {
    return {
      Details: {
        Type: 'Graph',
        Priority: 100,
        InputSchema: CloudCALZSchema,
        State: CloudCALZGraphState,
        Neurons: {
          'azure-calz': {
            Type: 'Circuit',
            CircuitLookup: 'thinky-getting-started:cloud:calz:resource-group',
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((state: CloudCALZGraphState, cfg) => {
                  return {
                    ...state,
                    Messages: state.Messages?.length
                      ? [state.Messages.slice(-1)[0]]
                      : [],
                  } as CloudCALZGraphState;
                })
              ),
          } as EaCCircuitNeuron,
          'azure-calz-commit:message': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant.  Let the user know that you are creating their Cloud Application Landing Zone (CALZ), and you'll be back with them shortly once complete.`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((msg: BaseMessage, cfg) => {
                  return {
                    Messages: [msg],
                  } as CloudCALZGraphState;
                })
              ),
          } as EaCChatPromptNeuron,
          'azure-calz-commit:tool': {
            Neurons: {
              '': 'thinky-getting-started:tools:cloud:calz',
            },
            Synapses: {
              '': [
                'fathym:eac:wait-for-status',
                {
                  Bootstrap: (r) =>
                    RunnableLambda.from(({ Status }: { Status: EaCStatus }) => {
                      return {
                        Status,
                        Operation:
                          'Creating Initial Cloud Application Landing Zone',
                      };
                    }).pipe(r),
                } as Partial<EaCNeuron>,
              ],
            },
            Bootstrap: (r) =>
              RunnableLambda.from((state: CloudCALZGraphState) => {
                return {
                  Confirmed: state.Confirmed || false,
                  ResourceGroupLookup: state.ResourceGroupLookup ?? undefined,
                } as CloudCALZSchema;
              })
                .pipe(r)
                .pipe(
                  RunnableLambda.from(
                    ({ Status }: { Status: EaCStatus }, cfg) => {
                      return {
                        Messages: [
                          new FunctionMessage({
                            content: JSON.stringify(Status),
                            name: 'fathym-eac-status',
                          }),
                        ],
                      };
                    }
                  )
                ),
          } as Partial<EaCNeuron>,
          'azure-calz:complete': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant. Let the user know that you have completed configuring their Cloud Application Landing Zone (CALZ) and that you are analyzing next steps, and will be back with them shortly.`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((msg: BaseMessage, cfg) => {
                  return {
                    CALZCreated: true,
                    Messages: [msg],
                  } as CloudCALZGraphState;
                })
              ),
          } as EaCChatPromptNeuron,
        },
        Edges: {
          [START]: 'azure-calz',
          'azure-calz': {
            Node: {
              message: 'azure-calz-commit:message',
              tool: 'azure-calz-commit:tool',
              [END]: END,
            },
            Condition: (state: CloudCALZGraphState, cfg) => {
              if (state.Confirmed && state.ResourceGroupLookup) {
                return ['message', 'tool'];
              }

              return END;
            },
          },
          'azure-calz-commit:message': 'azure-calz:complete',
          'azure-calz-commit:tool': 'azure-calz:complete',
          'azure-calz:complete': END,
        },
        Bootstrap: (r) =>
          r.pipe(
            RunnableLambda.from(
              ({ CALZCreated, Messages }: CloudCALZGraphState, cfg) => {
                const lastAiMsgs = lastAiNotHumanMessages(Messages);

                return {
                  HasConfiguredCalz: CALZCreated,
                  Messages: lastAiMsgs,
                } as ThinkyGettingStartedGraphStateSchema;
              }
            )
          ),
      } as EaCGraphCircuitDetails,
    };
  }

  protected buildCloudCALZResourceGroupCircuit() {
    return {
      Details: {
        Type: 'Linear',
        Priority: 100,
        Neurons: {
          '': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant. Let the user know that you will help them collect the information you need to initialize their Cloud Application Landing Zone (CALZ). Once you have collected enough information to call the tool, make sure to confirm the information with the user. Once the user has confirmed, you can call the tool.`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': [
                'thinky-llm',
                {
                  ToolsAsFunctions: true,
                  ToolLookups: ['thinky|thinky-getting-started:calz'],
                } as Partial<EaCLLMNeuron>,
              ],
            },
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((msg: BaseMessage, cfg) => {
                  if (msg.additional_kwargs.tool_calls?.length) {
                    const tool = msg.additional_kwargs.tool_calls![0].function;

                    const toolArgs = JSON.parse(
                      tool.arguments
                    ) as CloudCALZSchema;

                    return {
                      Messages: undefined,
                      ResourceGroupLookup: toolArgs.ResourceGroupLookup,
                      Confirmed: toolArgs.Confirmed,
                    } as CloudCALZGraphState;
                  } else if (msg.additional_kwargs.function_call) {
                    const tool = msg.additional_kwargs.function_call;

                    const toolArgs = JSON.parse(
                      tool.arguments
                    ) as CloudCALZSchema;

                    return {
                      Messages: undefined,
                      ResourceGroupLookup: toolArgs.ResourceGroupLookup,
                      Confirmed: toolArgs.Confirmed,
                    } as CloudCALZGraphState;
                  } else {
                    return {
                      Messages: [msg],
                    } as CloudCALZGraphState;
                  }
                })
              ),
          } as EaCChatPromptNeuron,
        },
      } as EaCLinearCircuitDetails,
    };
  }

  protected buildGettingStartedCircuit() {
    return {
      Details: {
        Type: 'Graph',
        Priority: 100,
        PersistenceLookup: 'thinky|thinky-getting-started',
        InputSchema: ThinkyGettingStartedCircuitInputSchema,
        State: ThinkyGettingStartedGraphStateSchema,
        Neurons: {
          cloud: {
            Type: 'Circuit',
            CircuitLookup: 'thinky-getting-started:cloud',
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from(
                  (state: ThinkyGettingStartedGraphStateSchema, cfg) => {
                    const gettingStarted: ThinkyGettingStartedState =
                      cfg?.configurable?.RuntimeContext.State.GettingStarted;

                    return {
                      ...state,
                      HasAzureAccessToken: !!gettingStarted.AzureAccessToken,
                      HasConfiguredCloud:
                        state.HasConfiguredCloud ||
                        !!gettingStarted.CurrentCloud,
                      HasConfiguredCalz:
                        state.HasConfiguredCalz || !!gettingStarted.CurrentCALZ,
                    } as ThinkyGettingStartedGraphStateSchema;
                  }
                )
              ),
          } as EaCCircuitNeuron,
        },
        Edges: {
          [START]: {
            Node: {
              cloud: 'cloud',
              [END]: END,
            },
            Condition: (
              {
                Messages,
                HasAzureAccessToken,
                HasConfiguredCloud,
              }: ThinkyGettingStartedGraphStateSchema,
              cfg
            ) => {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              const lastMsg = Messages?.slice(-1)[0];

              const isAiMsg =
                lastMsg &&
                (lastMsg instanceof AIMessage ||
                  lastMsg instanceof AIMessageChunk);

              if (
                cfg?.configurable?.peek ||
                ((!!gettingStarted.AzureAccessToken === HasAzureAccessToken ||
                  (HasAzureAccessToken &&
                    !!gettingStarted.CurrentCloud === HasConfiguredCloud)) &&
                  isAiMsg)
              ) {
                return END;
              }

              const node = !gettingStarted?.CurrentCALZ ? 'cloud' : END;

              return node;
            },
          },
          cloud: END,
        },
        Bootstrap: (r) =>
          RunnableLambda.from(
            ({ Input }: ThinkyGettingStartedCircuitInputSchema) => {
              return {
                Messages: Input ? [new HumanMessage(Input)] : [],
              };
            }
          ).pipe(r),
      } as EaCGraphCircuitDetails,
    };
  }
}

export function lastAiNotHumanMessages(messages?: BaseMessage[]) {
  return lastMessagesOfType(
    messages ?? [],
    [AIMessage.name, AIMessageChunk.name],
    [HumanMessage.name, HumanMessageChunk.name]
  );
}

export function lastMessagesOfType(
  messages: BaseMessage[],
  types: string[],
  endTypes?: string[]
) {
  let hitEnd = false;

  const lastMsgs = messages?.reverse().reduce((acc, msg) => {
    if (!hitEnd) {
      if (types.includes(msg.constructor.name)) {
        acc.unshift(msg);
      }

      if (
        endTypes
          ? endTypes.includes(msg.constructor.name)
          : !types.includes(msg.constructor.name)
      ) {
        hitEnd = true;
      }
    }

    return acc;
  }, [] as BaseMessage[]);

  return lastMsgs;
}
