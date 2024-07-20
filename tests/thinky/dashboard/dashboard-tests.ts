import ThinkyRuntimePlugin from '../../../src/plugins/ThinkyRuntimePlugin.ts';
import {
  assert,
  EverythingAsCodeDatabases,
  EverythingAsCodeSynaptic,
  Runnable,
} from '../../tests.deps.ts';
import { buildTestIoC } from '../../test-eac-setup.ts';

Deno.test('Thinky Dashboard Circuits Tests', async (t) => {
  const eac = {} as EverythingAsCodeSynaptic & EverythingAsCodeDatabases;

  const { ioc, kvCleanup } = await buildTestIoC(eac, [
    new ThinkyRuntimePlugin(),
  ]);

  const thread_id = crypto.randomUUID();

  await t.step('Generic - Invoke', async () => {
    const circuit = await ioc.Resolve<Runnable>(
      ioc.Symbol('Circuit'),
      'thinky-dashboard',
    );

    const chunk = await circuit.invoke(
      {
        // Messages: [
        //   new HumanMessage(
        //     'Tell me about Circuits in a haiku, formatted so everything is centered.'
        //   ),
        // ],
      },
      {
        configurable: {
          thread_id,
        },
      },
    );

    assert(chunk.messages.slice(-1)[0].content, JSON.stringify(chunk));

    console.log(chunk.messages.slice(-1)[0].content);
  });

  await kvCleanup();
});
