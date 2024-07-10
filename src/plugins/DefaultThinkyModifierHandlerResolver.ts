import {
  EaCModifierAsCode,
  EverythingAsCodeClouds,
  EverythingAsCodeIdentity,
} from '@fathym/eac';
import {
  DefaultModifierMiddlewareResolver,
  EaCRuntimeHandler,
  ModifierHandlerResolver,
} from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import { loadEaCSvc } from '@fathym/eac/api';
import z from 'npm:zod';
import { getCookies } from 'https://deno.land/std@0.220.1/http/cookie.ts';

export const ThinkyGettingStartedState = z.object({
  AzureAccessToken: z.string().optional(),
  CurrentCloud: z
    .object({
      Lookup: z.string(),
      Name: z.string(),
    })
    .optional(),
  CurrentCALZ: z
    .object({
      ResourceGroupLookup: z.string(),
    })
    .optional(),
});

export type ThinkyGettingStartedState = z.infer<
  typeof ThinkyGettingStartedState
>;

export class DefaultThinkyModifierHandlerResolver
  implements ModifierHandlerResolver
{
  public async Resolve(ioc: IoCContainer, modifier: EaCModifierAsCode) {
    let resolver: EaCRuntimeHandler | undefined;

    if (modifier.Details?.Type === 'EaC') {
      resolver = async (req, ctx) => {
        if (ctx.State.EnterpriseLookup) {
          const svc = await loadEaCSvc(ctx.State.JWT as string);

          const eac = (ctx.State.EaC = await svc.Get(
            ctx.State.EnterpriseLookup as string
          ));

          if (eac) {
            ctx.State.GettingStarted = await this.computeGettingStartedState(
              ioc,
              req,
              eac,
              ctx.Runtime.EaC
            );
          }
        }

        return await ctx.Next();
      };
    }

    if (!resolver) {
      const defaultResolver = new DefaultModifierMiddlewareResolver();

      resolver = await defaultResolver.Resolve(ioc, modifier);
    }

    return resolver;
  }

  protected async computeGettingStartedState(
    ioc: IoCContainer,
    req: Request,
    eac: EverythingAsCodeClouds,
    parentEaC: EverythingAsCodeIdentity
  ): Promise<ThinkyGettingStartedState> {
    const cloudLookups = Object.keys(eac.Clouds || {});

    const curCloud =
      cloudLookups[0] && 'ID' in (eac.Clouds?.[cloudLookups[0]].Details || {})
        ? eac.Clouds![cloudLookups[0]]
        : undefined;

    const state = {
      AzureAccessToken: undefined,
      CurrentCloud: curCloud
        ? {
            Lookup: cloudLookups[0],
            Name: curCloud.Details!.Name!,
          }
        : undefined,
    } as ThinkyGettingStartedState;

    if (curCloud && Object.keys(curCloud.ResourceGroups || {}).length) {
      state.CurrentCALZ = {
        ResourceGroupLookup: Object.keys(curCloud.ResourceGroups || {})[0],
      };
    }

    if (parentEaC && !curCloud) {
      const providerLookup = 'azure';

      const provider = parentEaC.Providers![providerLookup]!;

      const getSessionId = (req: Request) => {
        const cookies = getCookies(req.headers);

        return cookies['SessionID'];
      };

      const sessionId = await getSessionId(req);

      const oauthKv = await ioc.Resolve<Deno.Kv>(
        Deno.Kv,
        provider.DatabaseLookup
      );

      const currentAccTok = await oauthKv.get<string>([
        'MSAL',
        'Session',
        sessionId!,
        'AccessToken',
      ]);

      if (currentAccTok.value) {
        state.AzureAccessToken = currentAccTok.value;
      }
    }

    return state;
  }
}
