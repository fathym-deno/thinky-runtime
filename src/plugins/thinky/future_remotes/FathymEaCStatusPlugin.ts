import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac-runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCAzureOpenAILLMDetails,
  EaCChatPromptNeuron,
  EaCCircuitNeuron,
  EaCDynamicToolDetails,
  EaCGraphCircuitDetails,
  EaCLLMNeuron,
  EaCNeuron,
  EaCToolNeuron,
  InferSynapticState,
  TypeToZod,
} from '@fathym/synaptic';
import z from 'npm:zod';
import { MessagesPlaceholder } from '@langchain/core/prompts';
import { BaseMessage } from '@langchain/core/messages';
import { END, START } from '@langchain/langgraph';
import { EaCStatus, EaCStatusProcessingTypes } from '@fathym/eac-api';
import { loadEaCSvc } from '@fathym/eac-api/client';
import { delay } from 'https://deno.land/std@0.220.1/async/delay.ts';

export const FathymEaCStatusGraphState = {
  Messages: {
    value: (x?: BaseMessage[], y?: BaseMessage[]) =>
      !x && y ? y : x && !y ? x : x && y ? x.concat(y) : [],
    default: () => [],
  },
  Operation: {
    value: (_x: string, y: string) => y,
    default: () => '',
  },
  Status: {
    value: (_x: EaCStatus, y: EaCStatus) => y,
    default: () => undefined,
  },
};

export type FathymEaCStatusGraphState = InferSynapticState<
  typeof FathymEaCStatusGraphState
>;

export const FathymEaCStatusGraphStateSchema = z.object({
  Messages: z
    .array(z.custom<BaseMessage>())
    .optional()
    .describe('The message history to use.'),
  Operation: z
    .string()
    .describe('The description of th overal commit that is executing.'),
  Status: z
    .custom<EaCStatus>()
    .describe('The EaC status that is going to be tracked.'),
} as TypeToZod<FathymEaCStatusGraphState>);

export const FathymEaCStatusInputSchema = FathymEaCStatusGraphStateSchema.pick({
  Operation: true,
  Status: true,
}).extend({
  Delay: z
    .number()
    .optional()
    .describe(
      'This value should only be set when creating a new subscription, and should not be defined when using an existing `SubscriptionID`.',
    ),
});

export type FathymEaCStatusInputSchema = z.infer<
  typeof FathymEaCStatusInputSchema
>;

export const FathymEaCStatusToolSchema = z.custom<EaCStatus>();

export type FathymEaCStatusToolSchema = z.infer<
  typeof FathymEaCStatusToolSchema
>;

export class FathymEaCStatusPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: FathymEaCStatusPlugin.name,
      Plugins: [],
      EaC: {
        $neurons: {},
        AIs: {
          [FathymEaCStatusPlugin.name]: {
            LLMs: {
              'azure-openai': {
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
            },
            Tools: {
              'fathym-eac-status': {
                Details: {
                  Type: 'Dynamic',
                  Name: 'fathym-eac-status',
                  Description: 'Use this tool to get the status of an EaC commit operation.',
                  Schema: FathymEaCStatusToolSchema,
                  Action: async (status: FathymEaCStatusToolSchema) => {
                    try {
                      const parentEaCSvc = await loadEaCSvc();

                      const jwt = await parentEaCSvc.JWT(
                        status.EnterpriseLookup,
                        status.Username,
                      );

                      const eacSvc = await loadEaCSvc(jwt.Token);

                      status = await eacSvc.Status(
                        status.EnterpriseLookup,
                        status.ID,
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
            [`${FathymEaCStatusPlugin.name}|llm`]: {
              Type: 'LLM',
              LLMLookup: `${FathymEaCStatusPlugin.name}|azure-openai`,
            } as EaCLLMNeuron,
            [`${FathymEaCStatusPlugin.name}|wait-for-status`]: {
              Type: 'Circuit',
              CircuitLookup: `${FathymEaCStatusPlugin.name}:wait-for-status`,
            } as EaCCircuitNeuron,
            [`${FathymEaCStatusPlugin.name}|status`]: {
              Type: 'Tool',
              ToolLookup: `${FathymEaCStatusPlugin.name}|fathym-eac-status`,
              BootstrapOutput(toolRes: string) {
                return JSON.parse(toolRes);
              },
            } as EaCToolNeuron,
          },
          [`${FathymEaCStatusPlugin.name}|wait-for-status`]: this
            .buildFathymEaCWaitForStatusCircuit(),
        },
      },
      IoC: new IoCContainer(),
    };

    return Promise.resolve(pluginConfig);
  }

  protected buildFathymEaCWaitForStatusCircuit() {
    return {
      Details: {
        Type: 'Graph',
        Priority: 100,
        InputSchema: FathymEaCStatusInputSchema,
        State: FathymEaCStatusGraphState,
        BootstrapInput(
          { Delay, Operation, Status }: FathymEaCStatusInputSchema,
          _,
          cfg,
        ) {
          if (typeof Status === 'string') {
            Status = JSON.parse(Status) as EaCStatus;
          }

          cfg!.configurable!.delay = Delay ?? cfg!.configurable!.delay ?? 10000;

          return {
            Messages: [],
            Operation,
            Status,
          } as FathymEaCStatusGraphState;
        },
        Neurons: {
          'status:tool': [
            `${FathymEaCStatusPlugin.name}|status`,
            {
              BootstrapInput(state: FathymEaCStatusGraphState) {
                return state.Status;
              },
              BootstrapOutput(status: EaCStatus) {
                return {
                  Status: status,
                } as FathymEaCStatusGraphState;
              },
            } as Partial<EaCNeuron>,
          ],
          'status:delay': {
            async BootstrapInput(s, _, cfg) {
              await delay(cfg!.configurable!.delay || 7500);

              return s;
            },
          } as Partial<EaCNeuron>,
          'status:message': {
            Type: 'ChatPrompt',
            BootstrapInput(state: FathymEaCStatusGraphState) {
              const msgs = state.Messages?.length
                ? [...state.Messages.slice(0, 2), ...state.Messages.slice(-5)]
                : [];

              return {
                Messages: msgs,
                Operation: state.Operation,
                Status: JSON.stringify(state.Status),
              };
            },
            SystemMessage:
              `You are Thinky, the user's Fathym assistant. Inform the user of the status of their operation and let them know you'll check the status again shortly. Do your best to summarize the status in a short and concise way. The user can't give you more information, so do your best to summarize the Status information based on the Operation Context if not enough details are provided. Don't ask questions, just summarize, and let the user know you'll be back with updates. Make sure your answer always starts with two new markdown, to keep information separated.
            
Operation Context:
{Operation}`,
            Messages: [new MessagesPlaceholder('Messages')],
            NewMessages: [
              [
                'human',
                'Can you help summarize my current EaC Status in a super concise way:',
              ],
              ['human', '{Status}'],
            ],
            Neurons: {
              '': `${FathymEaCStatusPlugin.name}|llm`,
            },
            BootstrapOutput(msg: BaseMessage) {
              return {
                Messages: [msg],
              } as FathymEaCStatusGraphState;
            },
          } as EaCChatPromptNeuron,
        },
        Edges: {
          [START]: 'status:tool',
          'status:tool': {
            Node: {
              message: 'status:message',
              [END]: END,
            },
            Condition: ({ Status }: FathymEaCStatusGraphState) => {
              if (
                Status.Processing === EaCStatusProcessingTypes.COMPLETE ||
                Status.Processing === EaCStatusProcessingTypes.ERROR
              ) {
                console.log(Status);
                return END;
              }

              return 'message';
            },
          },
          'status:message': 'status:delay',
          'status:delay': 'status:tool',
        },
        BootstrapOutput({ Messages, Status }: FathymEaCStatusGraphState) {
          return {
            Messages,
            Status,
          } as FathymEaCStatusGraphState;
        },
      } as EaCGraphCircuitDetails,
    };
  }
}
