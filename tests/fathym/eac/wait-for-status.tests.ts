import ThinkyRuntimePlugin from '../../../src/plugins/ThinkyRuntimePlugin.ts';
import {
  assert,
  assertEquals,
  assertStringIncludes,
  BaseMessage,
  EaCChatPromptNeuron,
  EaCDynamicToolDetails,
  EaCGraphCircuitDetails,
  EaCNeuron,
  EaCToolNeuron,
  END,
  EverythingAsCodeDatabases,
  EverythingAsCodeSynaptic,
  HumanMessage,
  MessagesPlaceholder,
  Runnable,
  RunnableLambda,
  START,
  z,
} from '../../test.deps.ts';
import { buildTestIoC } from '../../test-eac-setup.ts';
import { EaCStatus, EaCStatusProcessingTypes } from '@fathym/eac/api';
import { delay } from 'https://deno.land/std@0.220.1/async/delay.ts';

Deno.test('Fathym EaC WaitForStatus Tests', async (t) => {
  let count = 0;

  const eac = {
    AIs: {
      thinky: {
        Tools: {
          'test:fathym:eac:status': {
            Details: {
              Type: 'Dynamic',
              Name: 'fathym-eac-status',
              Description:
                'Use this tool to get the status of an EaC commit operation.',
              Schema: z.object({
                Status: z.custom<EaCStatus>(),
              }),
              Action: ({ Status }: { Status: EaCStatus }) => {
                if (count >= 3) {
                  Status.Processing = EaCStatusProcessingTypes.COMPLETE;
                }

                count++;

                return Promise.resolve(JSON.stringify(Status));
              },
            } as EaCDynamicToolDetails,
          },
        },
      },
    },
    Circuits: {
      $neurons: {
        'test:fathym:eac:status': {
          Type: 'Tool',
          ToolLookup: 'thinky|test:fathym:eac:status',
          Bootstrap: (r) =>
            r.pipe(
              RunnableLambda.from((toolRes: string) => {
                return { Status: JSON.parse(toolRes) };
              })
            ),
        } as EaCToolNeuron,
      },
      'test:fathym:eac:wait-for-status': {
        Details: {
          Type: 'Graph',
          Priority: 100,
          InputSchema: z.object({
            Messages: z.array(z.custom<BaseMessage>()),
            Operation: z.string(),
            Status: z.custom<EaCStatus>(),
          }),
          State: {
            Messages: {
              value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
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
          },
          Neurons: {
            'status:tool': 'test:fathym:eac:status',
            'status:delay': {
              Bootstrap: (r) =>
                RunnableLambda.from(async (s) => {
                  console.log('delaying');
                  await delay(5000);
                  console.log('delayed');

                  return s;
                }).pipe(r),
            } as Partial<EaCNeuron>,
            'status:message': {
              Type: 'ChatPrompt',
              SystemMessage: `You are Thinky, the user's Fathym assistant. Inform the user of the status of their operation and let them know you'll check the status again shortly.
              
Operation Context:
{Operation}

EaC Status:
{Status}`,
              NewMessages: [new MessagesPlaceholder('Messages')],
              Neurons: {
                '': 'thinky-llm',
              },
              Bootstrap: (r) =>
                RunnableLambda.from((state) => {
                  console.log('status:message=>input');
                  console.log(state);

                  return state;
                })
                  .pipe(r)
                  .pipe(
                    RunnableLambda.from((msg: BaseMessage) => {
                      return {
                        Messages: [msg],
                      };
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
              Condition: ({ Status }: { Status: EaCStatus }) => {
                console.log('Tool Condition Status');
                console.log(Status);

                if (
                  Status.Processing === EaCStatusProcessingTypes.COMPLETE ||
                  Status.Processing === EaCStatusProcessingTypes.ERROR
                ) {
                  return END;
                }

                console.log('message');
                return 'message';
              },
            },
            'status:message': 'status:delay',
            'status:delay': 'status:tool',
          },
          Bootstrap: (r) =>
            RunnableLambda.from(
              ({
                Operation,
                Status,
              }: {
                Operation: string;
                Status: EaCStatus | string;
              }) => {
                if (typeof Status === 'string') {
                  Status = JSON.parse(Status) as EaCStatus;
                }

                return {
                  Operation,
                  Status,
                };
              }
            )
              .pipe(r)
              .pipe(
                RunnableLambda.from(
                  ({
                    Messages,
                    Status,
                  }: {
                    Messages: BaseMessage[];
                    Status: EaCStatus | string;
                  }) => {
                    return {
                      Messages,
                      Status,
                    };
                  }
                )
              ),
        } as EaCGraphCircuitDetails,
      },
    },
  } as EverythingAsCodeSynaptic & EverythingAsCodeDatabases;

  const { ioc, kvCleanup } = await buildTestIoC(eac, [
    new ThinkyRuntimePlugin(),
  ]);

  await t.step('Invoke', async () => {
    const circuit = await ioc.Resolve<Runnable>(
      ioc.Symbol('Circuit'),
      'test:fathym:eac:wait-for-status'
    );

    const chunk = await circuit.invoke({
      Messages: [],
      Operation: 'Updating Something',
      Status: {
        ID: crypto.randomUUID(),
        EnterpriseLookup: crypto.randomUUID(),
        Messages: {},
        Processing: EaCStatusProcessingTypes.PROCESSING,
        StartTime: new Date(),
        Username: 'me-testing',
      } as EaCStatus,
    });

    assert(chunk.Status);
    assertEquals(count, 4);

    console.log(chunk);
  });

  await kvCleanup();
});
