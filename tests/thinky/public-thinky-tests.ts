import ThinkyRuntimePlugin from '../../src/plugins/ThinkyRuntimePlugin.ts';
import {
  assert,
  assertStringIncludes,
  EverythingAsCodeDatabases,
  EverythingAsCodeSynaptic,
  HumanMessage,
  Runnable,
} from '../test.deps.ts';
import { buildTestIoC } from './test-eac-setup.ts';

Deno.test('Public Thinky Circuits Tests', async (t) => {
  const eac = {} as EverythingAsCodeSynaptic & EverythingAsCodeDatabases;

  const { ioc, kvCleanup } = await buildTestIoC(eac, [
    new ThinkyRuntimePlugin(),
  ]);

  // await t.step('Welcome Chat', async (t) => {
  //   await t.step('New User - Invoke', async () => {
  //     const circuit = await ioc.Resolve<Runnable>(
  //       ioc.Symbol('Circuit'),
  //       'thinky-public:welcome-chat'
  //     );

  //     const chunk = await circuit.invoke({
  //       IsNewUser: true,
  //       Username: '',
  //     });

  //     assert(chunk.content, JSON.stringify(chunk));
  //     assert(
  //       chunk.content.includes('Welcome') || chunk.content.includes('welcome'),
  //       `Message must contain 'welcome'`
  //     );
  //     assertStringIncludes(chunk.content, '(/dashboard)');
  //     assertStringIncludes(chunk.content, 'development journey');
  //     assertStringIncludes(chunk.content, '🐙');

  //     console.log(chunk.content);
  //   });

  //   await t.step('New User - Stream', async () => {
  //     const circuit = await ioc.Resolve<Runnable>(
  //       ioc.Symbol('Circuit'),
  //       'thinky-public:welcome-chat'
  //     );

  //     const chunks = await circuit.stream({
  //       IsNewUser: true,
  //       Username: '',
  //     });

  //     let message = '';

  //     for await (const chunk of chunks) {
  //       message += chunk.content;

  //       console.log(chunk.content);
  //     }

  //     assert(message);
  //     assert(
  //       message.includes('Welcome') || message.includes('welcome'),
  //       `Message must contain 'welcome'`
  //     );
  //     assertStringIncludes(message, '(/dashboard)');
  //     assertStringIncludes(message, 'development journey');
  //     assertStringIncludes(message, '🐙');

  //     console.log(message);
  //   });
  // });

  await t.step('Open Chat', async (t) => {
    await t.step('Generic - Invoke', async () => {
      const circuit = await ioc.Resolve<Runnable>(
        ioc.Symbol('Circuit'),
        'thinky-public:open-chat',
      );

      const chunk = await circuit.invoke(
        {
          Messages: [
            new HumanMessage(
              'Tell me about Circuits in a haiku, formatted so everything is centered.',
            ),
          ],
        },
        {
          configurable: {
            thread_id: 'testing',
          },
        },
      );

      assert(chunk.Messages.slice(-1)[0].content, JSON.stringify(chunk));

      console.log(chunk.Messages.slice(-1)[0].content);
    });

    // await t.step('Generic - Stream', async () => {
    //   const circuit = await ioc.Resolve<Runnable>(
    //     ioc.Symbol('Circuit'),
    //     'thinky-public:open-chat'
    //   );

    //   const events = await circuit.streamEvents(
    //     {
    //       Messages: [
    //         new HumanMessage(
    //           'Tell me about Circuits in a haiku, formatted so everything is centered.'
    //         ),
    //       ],
    //     },
    //     {
    //       version: 'v2',
    //       configurable: {
    //         thread_id: 'testing',
    //       },
    //     }
    //   );

    //   let message = '';

    //   for await (const event of events) {
    //     if (event.event === 'on_chat_model_stream') {
    //       const chunk = event.data?.chunk;

    //       message += chunk.content;

    //       console.log(chunk.content);
    //     }
    //   }

    //   assert(message);

    //   console.log(message);
    // });

    await t.step('Another - Invoke', async () => {
      const circuit = await ioc.Resolve<Runnable>(
        ioc.Symbol('Circuit'),
        'thinky-public:open-chat',
      );

      const chunk = await circuit.invoke(
        {
          Messages: [new HumanMessage('Tell me another.')],
        },
        {
          configurable: {
            thread_id: 'testing',
          },
        },
      );

      assert(chunk.Messages.slice(-1)[0].content, JSON.stringify(chunk));

      console.log(chunk.Messages.slice(-1)[0].content);
    });
  });

  // await t.step('Thinky Public', async (t) => {
  //   const thread_id = crypto.randomUUID();

  //   await t.step('Welcome Chat', async (t) => {
  //     await t.step('New User - Invoke', async () => {
  //       const circuit = await ioc.Resolve<Runnable>(
  //         ioc.Symbol('Circuit'),
  //         'thinky-public'
  //       );

  //       const chunk = await circuit.invoke({}, { configurable: { thread_id } });

  //       const message = chunk.Messages.slice(-1)[0];

  //       assert(message.content, JSON.stringify(chunk));

  //       console.log(message.content);

  //       assert(
  //         message.content.includes('Welcome') ||
  //           message.content.includes('welcome'),
  //         `Message must contain 'welcome'`
  //       );
  //       assertStringIncludes(message.content, '(/dashboard)');
  //       assertStringIncludes(message.content, 'development journey');
  //       assertStringIncludes(message.content, '🐙');
  //     });

  //     // await t.step('New User - Stream', async () => {
  //     //   const circuit = await ioc.Resolve<Runnable>(
  //     //     ioc.Symbol('Circuit'),
  //     //     'thinky-public'
  //     //   );

  //     //   const events = await circuit.streamEvents(
  //     //     {},
  //     //     {
  //     //       version: 'v2',
  //     //       configurable: { thread_id: `${thread_id}-stream` },
  //     //     }
  //     //   );

  //     //   let message = '';

  //     //   for await (const event of events) {
  //     //     if (event.event === 'on_chat_model_stream') {
  //     //       const chunk = event.data?.chunk;

  //     //       message += chunk.content;

  //     //       console.log(chunk.content);
  //     //     }
  //     //   }

  //     //   assert(message);
  //     //   assert(
  //     //     message.includes('Welcome') || message.includes('welcome'),
  //     //     `Message must contain 'welcome'`
  //     //   );
  //     //   assertStringIncludes(message, '(/dashboard)');
  //     //   assertStringIncludes(message, 'development journey');
  //     //   assertStringIncludes(message, '🐙');

  //     //   console.log(message);
  //     // });
  //   });

  //   await t.step('Open Chat', async (t) => {
  //     await t.step('Generic - Invoke', async () => {
  //       const circuit = await ioc.Resolve<Runnable>(
  //         ioc.Symbol('Circuit'),
  //         'thinky-public'
  //       );

  //       const chunk = await circuit.invoke(
  //         {
  //           Input:
  //             'Tell me about Circuits in a haiku, formatted so everything is centered.',
  //         },
  //         { configurable: { thread_id } }
  //       );

  //       const message = chunk.Messages.slice(-1)[0];

  //       assert(message.content, JSON.stringify(chunk));

  //       console.log(message.content);
  //     });

  //     // await t.step('Generic - Stream', async () => {
  //     //   const circuit = await ioc.Resolve<Runnable>(
  //     //     ioc.Symbol('Circuit'),
  //     //     'thinky-public'
  //     //   );

  //     //   const events = await circuit.streamEvents(
  //     //     {
  //     //       Input:
  //     //         'Tell me about Circuits in a haiku, formatted so everything is centered.',
  //     //     },
  //     //     {
  //     //       version: 'v2',
  //     //       configurable: { thread_id: `${thread_id}-stream` },
  //     //     }
  //     //   );

  //     //   let message = '';

  //     //   for await (const event of events) {
  //     //     if (event.event === 'on_chat_model_stream') {
  //     //       const chunk = event.data?.chunk;

  //     //       message += chunk.content;

  //     //       console.log(chunk.content);
  //     //     }
  //     //   }

  //     //   assert(message);

  //     //   console.log(message);
  //     // });
  //   });

  //   await t.step('Open Chat - Recall', async (t) => {
  //     await t.step('Another - Invoke', async () => {
  //       const circuit = await ioc.Resolve<Runnable>(
  //         ioc.Symbol('Circuit'),
  //         'thinky-public'
  //       );

  //       const chunk = await circuit.invoke(
  //         {
  //           Input:
  //             'Tell me another.',
  //         },
  //         { configurable: { thread_id } }
  //       );

  //       const message = chunk.Messages.slice(-1)[0];

  //       assert(message.content, JSON.stringify(chunk));

  //       console.log(message.content);
  //     });

  //     // await t.step('Another - Stream', async () => {
  //     //   const circuit = await ioc.Resolve<Runnable>(
  //     //     ioc.Symbol('Circuit'),
  //     //     'thinky-public'
  //     //   );

  //     //   const events = await circuit.streamEvents(
  //     //     {
  //     //       Input:
  //     //         'Tell me another.',
  //     //     },
  //     //     {
  //     //       version: 'v2',
  //     //       configurable: { thread_id: `${thread_id}-stream` },
  //     //     }
  //     //   );

  //     //   let message = '';

  //     //   for await (const event of events) {
  //     //     if (event.event === 'on_chat_model_stream') {
  //     //       const chunk = event.data?.chunk;

  //     //       message += chunk.content;

  //     //       console.log(chunk.content);
  //     //     }
  //     //   }

  //     //   assert(message);

  //     //   console.log(message);
  //     // });
  //   });
  // });

  await kvCleanup();
});
