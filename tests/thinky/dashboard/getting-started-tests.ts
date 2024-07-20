import ThinkyRuntimePlugin from '../../../src/plugins/ThinkyRuntimePlugin.ts';
import {
  assert,
  EverythingAsCodeDatabases,
  EverythingAsCodeSynaptic,
  Runnable,
} from '../../tests.deps.ts';
import { buildTestIoC } from '../../test-eac-setup.ts';

Deno.test('Thinky Dashboard - Getting Started Circuits Tests', async (t) => {
  const eac = {} as EverythingAsCodeSynaptic & EverythingAsCodeDatabases;

  const { ioc, kvCleanup } = await buildTestIoC(eac, [
    new ThinkyRuntimePlugin(),
  ]);

  const thread_id = crypto.randomUUID();

  await t.step('thinky-getting-started', async (t) => {
    await t.step('thinky-getting-started:cloud', async (t) => {
      await t.step('thinky-getting-started:cloud:azure-connect', async (t) => {
        await t.step('Azure Login', async () => {
          const circuit = await ioc.Resolve<Runnable>(
            ioc.Symbol('Circuit'),
            'thinky-getting-started:cloud:azure-connect',
          );

          const chunk = await circuit.invoke(
            {},
            {
              configurable: {
                thread_id,
                RuntimeContext: {
                  State: {
                    GettingStarted: {},
                  },
                },
              },
            },
          );

          assert(chunk.Messages.slice(-1)[0]?.content, JSON.stringify(chunk));

          console.log(chunk.Messages.slice(-1)[0].content);
        });
      });

      await t.step('Azure Login', async () => {
        const circuit = await ioc.Resolve<Runnable>(
          ioc.Symbol('Circuit'),
          'thinky-getting-started:cloud',
        );

        const chunk = await circuit.invoke(
          {},
          {
            configurable: {
              thread_id,
              RuntimeContext: {
                State: {
                  GettingStarted: {},
                },
              },
            },
          },
        );

        assert(chunk.Messages.slice(-1)[0]?.content, JSON.stringify(chunk));

        console.log(chunk.Messages.slice(-1)[0].content);
      });
    });

    await t.step('Azure Login', async () => {
      const circuit = await ioc.Resolve<Runnable>(
        ioc.Symbol('Circuit'),
        'thinky-getting-started',
      );

      const chunk = await circuit.invoke(
        {},
        {
          configurable: {
            thread_id,
            RuntimeContext: {
              State: {
                GettingStarted: {},
              },
            },
          },
        },
      );

      assert(chunk.Messages.slice(-1)[0]?.content, JSON.stringify(chunk));

      console.log(chunk.Messages.slice(-1)[0].content);
    });

    await t.step('Azure Sub', async () => {
      const circuit = await ioc.Resolve<Runnable>(
        ioc.Symbol('Circuit'),
        'thinky-getting-started',
      );

      const chunk = await circuit.invoke(
        {},
        {
          configurable: {
            thread_id,
            RuntimeContext: {
              State: {
                GettingStarted: {
                  AzureAccessToken: 'xxx',
                },
              },
            },
          },
        },
      );

      assert(chunk.Messages.slice(-1)[0]?.content, JSON.stringify(chunk));

      console.log(chunk.Messages.slice(-1)[0].content);
    });

    // await t.step('Azure Login - Stream Events - Readable Stream', async () => {
    //   const circuit = await ioc.Resolve<Runnable>(
    //     ioc.Symbol('Circuit'),
    //     'thinky-getting-started',
    //   );

    //   const body = new ReadableStream({
    //     async start(controller) {
    //       const streamed = await circuit.streamEvents(
    //         { name: 'test' },
    //         {
    //           configurable: {
    //             thread_id,
    //             RuntimeContext: {
    //               State: {
    //                 GettingStarted: {
    //                   HasAzureConnection: false,
    //                 },
    //               },
    //             },
    //           },
    //           version: 'v2',
    //         },
    //       );

    //       for await (const event of streamed) {
    //         controller.enqueue({
    //           id: Date.now(),
    //           event: 'data',
    //           data: customStringify(event),
    //         } as ServerSentEventMessage);

    //         // await delay(1);
    //       }

    //       controller.enqueue({
    //         id: Date.now(),
    //         event: 'end',
    //       } as ServerSentEventMessage);

    //       controller.close();
    //     },
    //     cancel() {
    //       // divined.cancel();
    //     },
    //   });

    //   const sses = body.pipeThrough(new ServerSentEventStream());

    //   const resp = new Response(sses, {
    //     headers: {
    //       'Content-Type': 'text/event-stream',
    //       'Cache-Control': 'no-cache',
    //     },
    //   });

    //   const text = await resp.text();

    //   console.log(text);
    //   // assert(chunk.Messages.slice(-1)[0]?.content, JSON.stringify(chunk));

    //   // console.log(chunk.Messages.slice(-1)[0].content);
    // });
  });

  await kvCleanup();
});
