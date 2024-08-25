import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac-runtime';
import { MSALPlugin } from '@fathym/msal';
import { getCookies } from '@std/http';

export default class ThinkyMSALPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'OpenBiotechMSALPlugin',
      Plugins: [
        new MSALPlugin({
          async Resolve(ioc, _processor, eac) {
            const primaryProviderLookup = Object.keys(eac.Providers || {}).find(
              (pl) => eac.Providers![pl].Details!.IsPrimary,
            );

            const provider = eac.Providers![primaryProviderLookup!]!;

            const kv = await ioc.Resolve<Deno.Kv>(
              Deno.Kv,
              provider.DatabaseLookup,
            );

            const keyRoot = ['MSAL', 'Session'];

            const getSessionId = (req: Request) => {
              const cookies = getCookies(req.headers);

              return cookies['SessionID'];
            };

            return {
              async Clear(req) {
                const sessionId = getSessionId(req);

                const kvKey = [...keyRoot, sessionId!];

                const results = await kv.list({ prefix: kvKey });

                for await (const result of results) {
                  await kv.delete(result.key);
                }
              },
              async Load(req, key) {
                const sessionId = getSessionId(req);

                const kvKey = [...keyRoot, sessionId!, key];

                const res = await kv.get(kvKey);

                return res.value;
              },
              async Set(req, key, value) {
                const sessionId = getSessionId(req);

                const kvKey = [...keyRoot, sessionId!, key];

                await kv.set(kvKey, value, {
                  expireIn: 1000 * 60 * 30,
                });
              },
            };
          },
        }),
      ],
    };

    return Promise.resolve(pluginConfig);
  }
}
