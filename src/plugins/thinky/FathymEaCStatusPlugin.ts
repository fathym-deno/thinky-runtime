import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
} from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCChatPromptNeuron,
  EaCCircuitNeuron,
  EaCDynamicToolDetails,
  EaCGraphCircuitDetails,
  EaCNeuron,
  EaCToolNeuron,
  InferSynapticState,
  TypeToZod,
} from '@fathym/synaptic';
import z from 'npm:zod';
import { MessagesPlaceholder } from 'npm:@langchain/core/prompts';
import { BaseMessage } from 'npm:@langchain/core/messages';
import { END, START } from 'npm:@langchain/langgraph';
import { RunnableLambda } from 'npm:@langchain/core/runnables';
import {
  EaCStatus,
  EaCStatusProcessingTypes,
  loadEaCSvc,
} from '@fathym/eac/api';
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

export const FathymEaCStatusInputSchema = z.object({
  Delay: z
    .number()
    .optional()
    .describe(
      'This value should only be set when creating a new subscription, and should not be defined when using an existing `SubscriptionID`.'
    ),
  Messages: z
    .array(z.custom<EaCStatus>())
    .optional()
    .describe(
      'This value should only be set when creating a new subscription, and should not be defined when using an existing `SubscriptionID`.'
    ),
  Operation: z
    .string()
    .describe(
      'This value should only be set when using an existing subscription, and should not be defined when creating with a new `SubscriptionName`.'
    ),
  Status: z
    .custom<EaCStatus>()
    .describe(
      'This value should be set to true, only once a user has explicitly confirmed their selections for (`SubscriptionName` and `BillingAccount`) or `SubscriptionID`.'
    ),
}); // as TypeToZod<
//   FathymEaCStatusGraphState & {
//     Delay: number | undefined;
//   }
// >);

export type FathymEaCStatusInputSchema = z.infer<
  typeof FathymEaCStatusInputSchema
>;

// export const FathymEaCStatusToolSchema = z.custom<EaCStatus>();

// export type FathymEaCStatusToolSchema = z.infer<
//   typeof FathymEaCStatusToolSchema
// >;

export class FathymEaCStatusPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'FathymEaCStatusPlugin',
      Plugins: [],
      EaC: {
        $neurons: {},
        AIs: {
          thinky: {
            Tools: {
              'fathym:eac:status': {
                Details: {
                  Type: 'Dynamic',
                  Name: 'fathym-eac-status',
                  Description:
                    'Use this tool to get the status of an EaC commit operation.',
                  Schema: z.custom<EaCStatus>(),
                  Action: async (status: EaCStatus, _, cfg) => {
                    const state = cfg!.configurable!.RuntimeContext.State;

                    const jwt = state.JWT as string;

                    try {
                      const eacSvc = await loadEaCSvc(jwt);

                      status = await eacSvc.Status(
                        state.EnterpriseLookup,
                        status.ID
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
            'fathym:eac:wait-for-status': {
              Type: 'Circuit',
              CircuitLookup: 'fathym:eac:wait-for-status',
            } as EaCCircuitNeuron,
            'fathym:eac:status': {
              Type: 'Tool',
              ToolLookup: 'thinky|fathym:eac:status',
              Neurons: {
                '': {
                  Bootstrap: (r) =>
                    r.pipe(
                      RunnableLambda.from((toolRes: string) => {
                        return JSON.parse(toolRes);
                      })
                    ),
                } as Partial<EaCNeuron>,
              } as Partial<EaCNeuron>,
            } as EaCToolNeuron,
          },
          'fathym:eac:wait-for-status':
            this.buildFathymEaCWaitForStatusCircuit(),
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
        Neurons: {
          'status:tool': [
            'fathym:eac:status',
            {
              Bootstrap: (r) =>
                RunnableLambda.from((state: FathymEaCStatusGraphState) => {
                  return state.Status;
                })
                  .pipe(r)
                  .pipe(
                    RunnableLambda.from((status: EaCStatus) => {
                      return {
                        Status: status,
                      } as FathymEaCStatusGraphState;
                    })
                  ),
            } as Partial<EaCNeuron>,
          ],
          'status:delay': {
            Bootstrap: (r) =>
              RunnableLambda.from(async (s, cfg) => {
                await delay(cfg!.configurable!.delay);

                return s;
              }).pipe(r),
          } as Partial<EaCNeuron>,
          'status:message': {
            Type: 'ChatPrompt',
            SystemMessage: `You are Thinky, the user's Fathym assistant. Inform the user of the status of their operation and let them know you'll check the status again shortly. Do your best to summarize the status in a short and concise way. The user can't give you more information, so do your best to summarize the Status information based on the Operation Context if not enough details are provided. Don't ask questions, just summarize, and let the user know you'll be back with updates.
            
Operation Context:
{Operation}`,
            Messages: [new MessagesPlaceholder('Messages')],
            NewMessages: [
              ['human', 'Can you help summarize my current EaC Status:'],
              ['human', '{Status}'],
            ],
            Neurons: {
              '': 'thinky-llm',
            },
            Bootstrap: (r) =>
              r.pipe(
                RunnableLambda.from((msg: BaseMessage) => {
                  return {
                    Messages: [msg],
                  } as FathymEaCStatusGraphState;
                })
              ),
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
                return END;
              }

              return 'message';
            },
          },
          'status:message': 'status:delay',
          'status:delay': 'status:tool',
        },
        Bootstrap: (r) =>
          RunnableLambda.from(
            (
              {
                Delay,
                Messages,
                Operation,
                Status,
              }: FathymEaCStatusInputSchema,
              cfg
            ) => {
              if (typeof Status === 'string') {
                Status = JSON.parse(Status) as EaCStatus;
              }

              cfg!.configurable!.delay = Delay ?? 5000;

              return {
                Messages,
                Operation,
                Status,
              } as FathymEaCStatusGraphState;
            }
          )
            .pipe(r)
            .pipe(
              RunnableLambda.from(
                ({ Messages, Status }: FathymEaCStatusGraphState) => {
                  return {
                    Messages,
                    Status,
                  };
                }
              )
            ),
      } as EaCGraphCircuitDetails,
    };
  }
}
