import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCChatPromptNeuron,
  EaCCircuitAsCode,
  EaCCircuitNeuron,
  EaCDenoKVSaverPersistenceDetails,
  EaCDynamicToolDetails,
  EaCGraphCircuitDetails,
  EaCLinearCircuitDetails,
  EaCToolExecutorNeuron,
  InferSynapticState,
  TypeToZod,
} from '@fathym/synaptic';
import z from 'npm:zod';
import { MessagesPlaceholder } from 'npm:@langchain/core/prompts';
import { BaseMessagePromptTemplateLike } from 'npm:@langchain/core/prompts';
import { BaseMessage, HumanMessage, HumanMessageChunk } from 'npm:@langchain/core/messages';
import { END, START } from 'npm:@langchain/langgraph';
import { RunnableLambda } from 'npm:@langchain/core/runnables';
import { ThinkyGettingStartedState } from '../DefaultThinkyModifierHandlerResolver.ts';
import { EaCStatusProcessingTypes, FathymEaC, loadEaCSvc, waitForStatus } from '@fathym/eac/api';
import { EaCCloudAzureDetails, EaCCloudResourceFormatDetails } from '@fathym/eac';

export const ThinkyGettingStartedCircuitInputSchema = z.object({
  Input: z.string().optional(),
});

export type ThinkyGettingStartedCircuitInputSchema = z.infer<
  typeof ThinkyGettingStartedCircuitInputSchema
>;

export const ThinkyGettingStartedGraphStateSchema = {
  Messages: {
    value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  },
};

export type ThinkyGettingStartedGraphStateSchema = InferSynapticState<
  typeof ThinkyGettingStartedGraphStateSchema
>;

export const ThinkyGettingStartedStateSchema = z.custom<ThinkyGettingStartedGraphStateSchema>();

export const ThinkyGettingStartedCloudInputSchema = z.object({
  HasAzureConnection: z.boolean(),
});

export type ThinkyGettingStartedCloudInputSchema = z.infer<
  typeof ThinkyGettingStartedCloudInputSchema
>;

export const AzureConnectGraphState = {
  Messages: {
    value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
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
};

export type AzureConnectGraphState = InferSynapticState<
  typeof AzureConnectGraphState
>;

export const AzureConnectSchema = z.object({
  SubscriptionName: z
    .string()
    .optional()
    .describe(
      'This value shoul only be set when creating a new subscription, and should not be defined when using an existing `SubscriptionID`.',
    ),
  SubscriptionID: z
    .string()
    .optional()
    .describe(
      'This value is only be set when using an existing subscription, and should not be defined when creating with a new `SubscriptionName`.',
    ),
} as TypeToZod<Omit<AzureConnectGraphState, 'Messages'>>);

export type AzureConnectSchema = z.infer<typeof AzureConnectSchema>;

export const ThinkyGettingStartedCloudAIInfrastructureSchema = z.object({
  ResourceGroupLookup: z
    .string()
    .describe(
      'This is the unique name that a user can choose for their cloud resource group. (It must be alphanumeric in snake-case.',
    ),
  SubscriptionID: z.string(),
});

export type ThinkyGettingStartedCloudAIInfrastructureSchema = z.infer<
  typeof ThinkyGettingStartedCloudAIInfrastructureSchema
>;

export default class ThinkyGettingStartedPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyGettingStartedPlugin',
      Plugins: [],
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
              'cloud-azure-connect': {
                Details: {
                  Type: 'Dynamic',
                  Name: 'cloud-azure-connect',
                  Description:
                    'Use this tool to create an Azure Service Principal connection for a user, from a new or existing subscription.',
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
                          Token: state.AzureAccessToken,
                          Details: {
                            Type: 'Azure',
                            Name: input.SubscriptionName,
                            SubscriptionID: input.SubscriptionID,
                          } as EaCCloudAzureDetails,
                        },
                      },
                    };

                    try {
                      const eacSvc = await loadEaCSvc(jwt);

                      const commitResp = await eacSvc.Commit(commitEaC, 60);

                      const status = await waitForStatus(
                        eacSvc,
                        commitResp.EnterpriseLookup,
                        commitResp.CommitID,
                      );

                      if (
                        status.Processing == EaCStatusProcessingTypes.COMPLETE
                      ) {
                        return 'Complete, with no errors';
                      } else {
                        return `Errors before complete: ${status.Messages['Error'] as string}`;
                      }
                    } catch (ex) {
                      return JSON.stringify(ex);
                    }
                  },
                } as EaCDynamicToolDetails,
              },
              calz: {
                Details: {
                  Type: 'Dynamic',
                  Name: 'cloud-ai-infrastructure',
                  Description:
                    'Use this tool to commit a cloud, AI infrastructure definition for the user.',
                  Schema: ThinkyGettingStartedCloudAIInfrastructureSchema,
                  Action: async (
                    input: ThinkyGettingStartedCloudAIInfrastructureSchema,
                    _,
                    cfg,
                  ) => {
                    const state = cfg!.configurable!.RuntimeContext.State;

                    const jwt = state.JWT as string;

                    const eacSvc = await loadEaCSvc(jwt);

                    // TODO(mcgear): Get stored Azure token
                    const azureToken = '';

                    const cloudLookup = crypto.randomUUID();

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
                                    Description: 'The core CALZ to use for the enterprise.',
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

                    return '';
                  },
                } as EaCDynamicToolDetails,
              },
            },
          },
        },
        Circuits: {
          $neurons: {
            'thinky-getting-started:tools:cloud:azure-connect': {
              Type: 'ToolExecutor',
              ToolLookups: ['cloud-azure-connect'],
            } as EaCToolExecutorNeuron,
          },
          'thinky-getting-started:cloud:azure-connect': this.buildCloudAzureConnectCircuit(),
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
              const gettingStarted: ThinkyGettingStartedState = cfg?.configurable?.RuntimeContext
                .State.GettingStarted;

              return gettingStarted.CurrentCloud ? 'calz' : 'azure-connect';
            },
          },
          'azure-connect': END,
          calz: END,
        },
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
            SystemMessage:
              `You are Thinky, the user's Fathym assistant. Right now, your only job is to get the user connected with Azure. You should be friendly, end inspire confidence in the user, so they click. We need to link the user to \`/dashboard/thinky/connect/azure\`. It has to be that exact, absolute path, with no host/origin. Provide your response as Markdown, without any titles, just your responses as markdown. Markdwon example would be \`[...]('/dashboard/thinky/connect/azure')\``,
            NewMessages: [
              new HumanMessage('Hi'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((msg: BaseMessage) => ({
                  Messages: [msg],
                })),
              ),
          } as EaCChatPromptNeuron,
          'azure-sub': {
            Type: 'ChatPrompt',
            SystemMessage:
              `The only job you have is to inform the user if they have an azure connection, ignore any other questions!!:
            
HasAzureConnection: {HasAzureConnection}`,
            NewMessages: [
              new HumanMessage('Hi, do i have an azure connection?'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
          } as EaCChatPromptNeuron,
          //           'azure-sub-commit': {
          //             Type: 'ChatPrompt',
          //             SystemMessage: `The only job you have is to inform the user if they have an azure connection, ignore any other questions!!:

          // HasAzureConnection: {HasAzureConnection}`,
          //             NewMessages: [
          //               new HumanMessage('Hi, do i have an azure connection?'),
          //             ] as BaseMessagePromptTemplateLike[],
          //             Neurons: {
          //               '': 'thinky-llm',
          //             },
          //           } as EaCChatPromptNeuron,
          //           'azure-sub-verify': {
          //             Type: 'ChatPrompt',
          //             SystemMessage: `The only job you have is to inform the user if they have an azure connection, ignore any other questions!!:

          // HasAzureConnection: {HasAzureConnection}`,
          //             NewMessages: [
          //               new HumanMessage('Hi, do i have an azure connection?'),
          //             ] as BaseMessagePromptTemplateLike[],
          //             Neurons: {
          //               '': 'thinky-llm',
          //             },
          //           } as EaCChatPromptNeuron,
        },
        Edges: {
          [START]: {
            Node: {
              login: 'azure-login',
              sub: 'azure-sub',
            },
            Condition: (_, cfg) => {
              const gettingStarted: ThinkyGettingStartedState = cfg?.configurable?.RuntimeContext
                .State.GettingStarted;

              return gettingStarted.HasAzureConnection ? 'sub' : 'login';
            },
          },
          'azure-login': END,
          'azure-sub': END,
          // 'azure-sub': 'azure-sub-verify',
          // 'azure-sub-verify': {
          //   Node: {
          //     commit: 'azure-sub-commit',
          //     sub: 'azure-sub',
          //     [END]: END,
          //   },
          //   Condition: (_, cfg) => {
          //     return '';
          //   },
          // },
          // 'azure-sub-commit': END,
        },
      } as EaCGraphCircuitDetails,
    };
  }

  protected buildCloudCALZCircuit() {
    return {
      Details: {
        Type: 'Linear',
        Priority: 100,
        InputSchema: ThinkyGettingStartedCloudInputSchema,
        Neurons: {
          '': {
            Type: 'ChatPrompt',
            SystemMessage: `Just be super helpful.`,
            NewMessages: [
              new MessagesPlaceholder('Messages'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
          } as EaCChatPromptNeuron,
        },
        Bootstrap: (r) =>
          RunnableLambda.from(
            ({ Messages }: ThinkyGettingStartedGraphStateSchema, cfg) => {
              return {
                Messages,
              } as
                & ThinkyGettingStartedCloudInputSchema
                & ThinkyGettingStartedGraphStateSchema;
            },
          )
            .pipe(r)
            .pipe(
              RunnableLambda.from((msg: BaseMessage) => ({
                Messages: [msg],
              })),
            ),
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
              RunnableLambda.from(
                ({ Messages }: ThinkyGettingStartedGraphStateSchema) => {
                  return {
                    Messages,
                  } as ThinkyGettingStartedGraphStateSchema;
                },
              ).pipe(r),
          } as EaCCircuitNeuron,
        },
        Edges: {
          [START]: {
            Node: {
              cloud: 'cloud',
              [END]: END,
            },
            Condition: (_state, cfg) => {
              const gettingStarted = cfg?.configurable?.RuntimeContext.State.GettingStarted;

              const node = !gettingStarted?.CurrentCloud ? 'cloud' : END;

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
            },
          ).pipe(r),
      } as EaCGraphCircuitDetails,
    };
  }
}
