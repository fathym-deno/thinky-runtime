import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
} from '@fathym/eac-runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCChatPromptNeuron,
  EaCCircuitNeuron,
  EaCDenoKVSaverPersistenceDetails,
  EaCDynamicToolDetails,
  EaCGraphCircuitDetails,
  EaCLinearCircuitDetails,
  EaCLLMNeuron,
  EaCNeuron,
  EaCToolNeuron,
  InferSynapticState,
  lastAiNotHumanMessages,
  lastHumanMessages,
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
} from 'npm:@langchain/core/messages';
import { END, START } from 'npm:@langchain/langgraph';
import { ThinkyGettingStartedState } from '../DefaultThinkyModifierHandlerResolver.ts';
import { EaCStatus, FathymEaC } from '@fathym/eac-api';
import { loadEaCSvc } from '@fathym/eac-api/client';
import {
  EaCCloudAzureDetails,
  EaCCloudResourceFormatDetails,
} from '@fathym/eac/clouds';
import { FathymEaCRemotesPlugin } from './FathymEaCRemotesPlugin.ts';

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
  HasConfiguredCALZ: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  HasConfiguredCloud: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  HasConfiguredInfrastructure: {
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

export const CloudInfrastructureGraphState = {
  Confirmed: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  InfrastructureCreated: {
    value: (_x: boolean, y: boolean) => y,
    default: () => false,
  },
  Messages: {
    value: (x?: BaseMessage[], y?: BaseMessage[]) => x?.concat(y || []),
    default: () => [],
  },
  ResourceLookup: {
    value: (_x: string, y: string) => y,
    default: () => '',
  },
};

export type CloudInfrastructureGraphState = InferSynapticState<
  typeof CloudInfrastructureGraphState
>;

export const CloudInfrastructureSchema = z.object({
  Confirmed: z
    .boolean()
    .optional()
    .describe(
      'This value should be set to true, only once a user has explicitly confirmed their selections for `ResourceLookup`, and that the `ResourceLookup` is in alphanumeric, lowered snake-case (with hyphens (-)) format.'
    ),
  ResourceLookup: z
    .string()
    .optional()
    .describe(
      'This is a unique lookup/name that a user can choose for their AI resource, and must be in alphanumeric, lowered snake-case (with hyphens (-)) to work.'
    ),
} as TypeToZod<Omit<CloudInfrastructureGraphState, 'InfrastructureCreated' | 'Messages'>>);

export type CloudInfrastructureSchema = z.infer<
  typeof CloudInfrastructureSchema
>;

export default class ThinkyGettingStartedPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyGettingStartedPlugin',
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
              'thinky-getting-started:infrastructure': {
                Details: {
                  Type: 'Dynamic',
                  Name: 'calz',
                  Description:
                    'Use this tool to commit an AI Infrastructure Launch Pad to a resource group for the user.',
                  Schema: CloudInfrastructureSchema,
                  Action: async (input: CloudInfrastructureSchema, _, cfg) => {
                    const state = cfg!.configurable!.RuntimeContext.State;

                    const gettingStarted: ThinkyGettingStartedState =
                      state.GettingStarted;

                    const jwt = state.JWT as string;

                    const cloudLookup = Object.keys(state.EaC!.Clouds || {})[0];

                    const resGroupLookup =
                      gettingStarted.CurrentCALZ!.ResourceGroupLookup;

                    const resLookup = input.ResourceLookup;

                    const shortName = resGroupLookup
                      .split('-')
                      .map((p) => p.charAt(0))
                      .join('');

                    const commitEaC: FathymEaC = {
                      EnterpriseLookup: state.EnterpriseLookup,
                      Clouds: {
                        [cloudLookup]: {
                          ResourceGroups: {
                            [resGroupLookup]: {
                              Resources: {
                                [resLookup]: {
                                  Details: {
                                    Type: 'Format',
                                    Name: 'AI Infrastructure Launch Pad',
                                    Description:
                                      'The AI Infrastructure Launch Pad.',
                                    Order: 1,
                                    Template: {
                                      Content:
                                        'https://raw.githubusercontent.com/lowcodeunit/infrastructure/master/templates/ai/template.jsonc',
                                      Parameters:
                                        'https://raw.githubusercontent.com/lowcodeunit/infrastructure/master/templates/ai/parameters.jsonc',
                                    },
                                    Data: {
                                      CloudLookup: cloudLookup,
                                      ResourceLookup: resLookup,
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
            'thinky-getting-started:tools:cloud:calz': {
              Type: 'Tool',
              ToolLookup: 'thinky|thinky-getting-started:calz',
              BootstrapOutput(toolRes: string) {
                return { Status: JSON.parse(toolRes) };
              },
            } as EaCToolNeuron,
            'thinky-getting-started:tools:cloud:infrastructure': {
              Type: 'Tool',
              ToolLookup: 'thinky|thinky-getting-started:infrastructure',
              BootstrapOutput(toolRes: string) {
                return { Status: JSON.parse(toolRes) };
              },
            } as EaCToolNeuron,
          },
          'thinky-getting-started:cloud:calz:resource-group':
            this.buildCloudCALZResourceGroupCircuit(),
          'thinky-getting-started:cloud:calz': this.buildCloudCALZCircuit(),
          'thinky-getting-started:cloud:infrastructure:details':
            this.buildCloudInfrastructureDetailsCircuit(),
          'thinky-getting-started:cloud:infrastructure':
            this.buildCloudInfrastructureCircuit(),
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
            BootstrapInput(s: ThinkyGettingStartedGraphStateSchema, _, cfg) {
              const entLookup: string =
                cfg?.configurable?.RuntimeContext.State.EnterpriseLookup;

              const username: string =
                cfg?.configurable?.RuntimeContext.State.Username;

              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              const lastHumanMsg = lastHumanMessages(s.Messages)?.slice(-1)[0];

              return {
                EnterpriseLookup: entLookup,
                Username: username,
                APIRoot: '/dashboard/thinky',
                RedirectTo: '/dashboard/getting-started',
                AzureAccessTokenSecret: gettingStarted.AzureAccessToken,
                Input: lastHumanMsg?.content,
              };
            },
            Neurons: {
              '': `${FathymEaCRemotesPlugin.name}|cloud|azure-connect`,
            },
            BootstrapOutput({
              CloudConnected,
              Messages,
            }: {
              CloudConnected: boolean;
              Messages: BaseMessage[];
            }) {
              const lastAiMsgs = lastAiNotHumanMessages(Messages);

              return {
                HasConfiguredCloud: CloudConnected,
                Messages: lastAiMsgs,
              } as ThinkyGettingStartedGraphStateSchema;
            },
          },
          calz: {
            Type: 'Circuit',
            CircuitLookup: 'thinky-getting-started:cloud:calz',
            BootstrapOutput(
              state: ThinkyGettingStartedGraphStateSchema,
              _,
              cfg
            ) {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return {
                ...state,
                Messages: !gettingStarted.CurrentCloud
                  ? [state.Messages.slice(-1)[0]]
                  : state.Messages,
              };
            },
          } as EaCCircuitNeuron,
          infra: {
            Type: 'Circuit',
            CircuitLookup: 'thinky-getting-started:cloud:infrastructure',
            BootstrapOutput(
              state: ThinkyGettingStartedGraphStateSchema,
              _,
              cfg
            ) {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return {
                ...state,
                Messages: !gettingStarted.CurrentCALZ
                  ? [state.Messages.slice(-1)[0]]
                  : state.Messages,
              };
            },
          } as EaCCircuitNeuron,
        },
        Edges: {
          [START]: {
            Node: {
              'azure-connect': 'azure-connect',
              calz: 'calz',
              infra: 'infra',
              [END]: END,
            },
            Condition: (state: ThinkyGettingStartedGraphStateSchema, cfg) => {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return state.HasConfiguredInfrastructure
                ? END
                : gettingStarted.CurrentCALZ
                ? 'infra'
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
          calz: {
            Node: {
              infra: 'infra',
              [END]: END,
            },
            Condition: (state: ThinkyGettingStartedGraphStateSchema, cfg) => {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return state.HasConfiguredCALZ && !gettingStarted.CurrentCALZ
                ? 'infra'
                : END;
            },
          },
          infra: END,
        },
        BootstrapOutput(state: ThinkyGettingStartedGraphStateSchema) {
          const lastAiMsgs = lastAiNotHumanMessages(state.Messages);

          return {
            ...state,
            Messages: lastAiMsgs,
          };
        },
      } as EaCGraphCircuitDetails,
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
            BootstrapOutput(state: CloudCALZGraphState) {
              return {
                ...state,
                Messages: state.Messages?.length
                  ? [state.Messages.slice(-1)[0]]
                  : [],
              } as CloudCALZGraphState;
            },
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
            BootstrapOutput(msg: BaseMessage) {
              return {
                Messages: [msg],
              } as CloudCALZGraphState;
            },
          } as EaCChatPromptNeuron,
          'azure-calz-commit:tool': {
            Neurons: {
              '': 'thinky-getting-started:tools:cloud:calz',
            },
            Synapses: {
              '': [
                `${FathymEaCRemotesPlugin.name}|wait-for-status`,
                {
                  BootstrapInput({ Status }: { Status: EaCStatus }) {
                    return {
                      Delay: 10000,
                      Status,
                      Operation:
                        'Creating Initial Cloud Application Landing Zone',
                    };
                  },
                } as Partial<EaCNeuron>,
              ],
            },
            BootstrapInput(state: CloudCALZGraphState) {
              return {
                Confirmed: state.Confirmed || false,
                ResourceGroupLookup: state.ResourceGroupLookup ?? undefined,
              } as CloudCALZSchema;
            },
            BootstrapOutput({ Status }: { Status: EaCStatus }) {
              return {
                Messages: [
                  new FunctionMessage({
                    content: JSON.stringify(Status),
                    name: 'fathym-eac-status',
                  }),
                ],
              };
            },
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
            BootstrapOutput(msg: BaseMessage) {
              return {
                CALZCreated: true,
                Messages: [msg],
              } as CloudCALZGraphState;
            },
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
            Condition: (state: CloudCALZGraphState) => {
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
        BootstrapOutput({ CALZCreated, Messages }: CloudCALZGraphState) {
          const lastAiMsgs = lastAiNotHumanMessages(Messages);

          return {
            HasConfiguredCALZ: CALZCreated,
            Messages: lastAiMsgs,
          } as ThinkyGettingStartedGraphStateSchema;
        },
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
            BootstrapInput(state: CloudCALZGraphState, _, cfg) {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return {
                Messages:
                  !gettingStarted.CurrentCloud && state.Messages?.length
                    ? [state.Messages.slice(-1)[0]]
                    : state.Messages,
              } as CloudCALZGraphState;
            },
            BootstrapOutput(msg: BaseMessage) {
              if (msg.additional_kwargs.tool_calls?.length) {
                const tool = msg.additional_kwargs.tool_calls![0].function;

                const toolArgs = JSON.parse(tool.arguments) as CloudCALZSchema;

                return {
                  Messages: undefined,
                  ResourceGroupLookup: toolArgs.ResourceGroupLookup,
                  Confirmed: toolArgs.Confirmed,
                } as CloudCALZGraphState;
              } else if (msg.additional_kwargs.function_call) {
                const tool = msg.additional_kwargs.function_call;

                const toolArgs = JSON.parse(tool.arguments) as CloudCALZSchema;

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
            },
          } as EaCChatPromptNeuron,
        },
      } as EaCLinearCircuitDetails,
    };
  }

  protected buildCloudInfrastructureCircuit() {
    return {
      Details: {
        Type: 'Graph',
        Priority: 100,
        InputSchema: CloudInfrastructureSchema,
        State: CloudInfrastructureGraphState,
        Neurons: {
          'azure-infra': {
            Type: 'Circuit',
            CircuitLookup:
              'thinky-getting-started:cloud:infrastructure:details',
            BootstrapOutput(state: CloudInfrastructureGraphState) {
              return {
                ...state,
                Messages: state.Messages?.length
                  ? [state.Messages.slice(-1)[0]]
                  : [],
              } as CloudInfrastructureGraphState;
            },
          } as EaCCircuitNeuron,
          'azure-infra-commit:message': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant.  Let the user know that you are creating their AI Infrastructure Launch Pad, and you'll be back with them shortly once complete.`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
            BootstrapOutput(msg: BaseMessage) {
              return {
                Messages: [msg],
              } as CloudInfrastructureGraphState;
            },
          } as EaCChatPromptNeuron,
          'azure-infra-commit:tool': {
            Neurons: {
              '': 'thinky-getting-started:tools:cloud:infrastructure',
            },
            Synapses: {
              '': [
                `${FathymEaCRemotesPlugin.name}|wait-for-status`,
                {
                  BootstrapInput({ Status }: { Status: EaCStatus }) {
                    return {
                      Delay: 10000,
                      Status,
                      Operation: 'Creating AI Infrastructure Launch Pad',
                    };
                  },
                } as Partial<EaCNeuron>,
              ],
            },
            BootstrapInput(state: CloudInfrastructureGraphState) {
              return {
                Confirmed: state.Confirmed || false,
                ResourceLookup: state.ResourceLookup ?? undefined,
              } as CloudInfrastructureSchema;
            },
            BootstrapOutput({ Status }: { Status: EaCStatus }) {
              return {
                Messages: [
                  new FunctionMessage({
                    content: JSON.stringify(Status),
                    name: 'fathym-eac-status',
                  }),
                ],
              };
            },
          } as Partial<EaCNeuron>,
          'azure-infra:complete': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant. Let the user know that you have completed setting up their AI Infrastructure Launch Pad and that you are analyzing next steps, and will be back with them shortly.`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
            BootstrapOutput(msg: BaseMessage) {
              return {
                InfrastructureCreated: true,
                Messages: [msg],
              } as CloudInfrastructureGraphState;
            },
          } as EaCChatPromptNeuron,
        },
        Edges: {
          [START]: 'azure-infra',
          'azure-infra': {
            Node: {
              message: 'azure-infra-commit:message',
              tool: 'azure-infra-commit:tool',
              [END]: END,
            },
            Condition: (state: CloudInfrastructureGraphState) => {
              if (state.Confirmed && state.ResourceLookup) {
                return ['message', 'tool'];
              }

              return END;
            },
          },
          'azure-infra-commit:message': 'azure-infra:complete',
          'azure-infra-commit:tool': 'azure-infra:complete',
          'azure-infra:complete': END,
        },
        BootstrapOutput({
          InfrastructureCreated,
          Messages,
        }: CloudInfrastructureGraphState) {
          const lastAiMsgs = lastAiNotHumanMessages(Messages);

          return {
            HasConfiguredInfrastructure: InfrastructureCreated,
            Messages: lastAiMsgs,
          } as ThinkyGettingStartedGraphStateSchema;
        },
      } as EaCGraphCircuitDetails,
    };
  }

  protected buildCloudInfrastructureDetailsCircuit() {
    return {
      Details: {
        Type: 'Linear',
        Priority: 100,
        Neurons: {
          '': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant. Let the user know that you will help them collect the information you need to setup their AI Infrastructure Launch Pad. Make sure you aren't selecting the previously chosen 'ResourceGroupLookup', and instead are asking for the users AI Infrastructure resource name. Once you have collected enough information to call the tool, make sure to confirm the information with the user. Once the user has confirmed, you can call the tool.`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': [
                'thinky-llm',
                {
                  ToolsAsFunctions: true,
                  ToolLookups: ['thinky|thinky-getting-started:infrastructure'],
                } as Partial<EaCLLMNeuron>,
              ],
            },
            BootstrapInput(state: CloudInfrastructureGraphState, _, cfg) {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return {
                Messages:
                  !gettingStarted.CurrentCALZ && state.Messages?.length
                    ? [state.Messages.slice(-1)[0]]
                    : state.Messages,
              } as CloudInfrastructureGraphState;
            },
            BootstrapOutput(msg: BaseMessage) {
              if (msg.additional_kwargs.tool_calls?.length) {
                const tool = msg.additional_kwargs.tool_calls![0].function;

                const toolArgs = JSON.parse(
                  tool.arguments
                ) as CloudInfrastructureSchema;

                return {
                  Messages: undefined,
                  ResourceLookup: toolArgs.ResourceLookup,
                  Confirmed: toolArgs.Confirmed,
                } as CloudInfrastructureGraphState;
              } else if (msg.additional_kwargs.function_call) {
                const tool = msg.additional_kwargs.function_call;

                const toolArgs = JSON.parse(
                  tool.arguments
                ) as CloudInfrastructureSchema;

                return {
                  Messages: undefined,
                  ResourceLookup: toolArgs.ResourceLookup,
                  Confirmed: toolArgs.Confirmed,
                } as CloudInfrastructureGraphState;
              } else {
                return {
                  Messages: [msg],
                } as CloudInfrastructureGraphState;
              }
            },
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
            BootstrapOutput(
              state: ThinkyGettingStartedGraphStateSchema,
              _,
              cfg
            ) {
              const gettingStarted: ThinkyGettingStartedState =
                cfg?.configurable?.RuntimeContext.State.GettingStarted;

              return {
                ...state,
                HasAzureAccessToken: !!gettingStarted.AzureAccessToken,
                HasConfiguredCloud:
                  state.HasConfiguredCloud || !!gettingStarted.CurrentCloud,
                HasConfiguredCALZ:
                  state.HasConfiguredCALZ || !!gettingStarted.CurrentCALZ,
              } as ThinkyGettingStartedGraphStateSchema;
            },
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
                HasConfiguredCALZ,
                HasConfiguredInfrastructure,
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
                    !!gettingStarted.CurrentCloud === HasConfiguredCloud) ||
                  (HasAzureAccessToken &&
                    HasConfiguredCloud &&
                    !!gettingStarted.CurrentCALZ === HasConfiguredCALZ)) &&
                  isAiMsg)
              ) {
                return END;
              }

              const node = !HasConfiguredInfrastructure ? 'cloud' : END;

              return node;
            },
          },
          cloud: END,
        },
        BootstrapInput({ Input }: ThinkyGettingStartedCircuitInputSchema) {
          return {
            Messages: Input ? [new HumanMessage(Input)] : [],
          };
        },
      } as EaCGraphCircuitDetails,
    };
  }
}
