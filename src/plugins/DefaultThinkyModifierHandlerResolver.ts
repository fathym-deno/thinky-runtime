import { EaCModifierAsCode, EverythingAsCodeClouds } from '@fathym/eac';
import {
  DefaultModifierMiddlewareResolver,
  EaCRuntimeHandler,
  ModifierHandlerResolver,
} from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import { loadEaCSvc } from '@fathym/eac/api';
import z from 'npm:zod';

export const ThinkyGettingStartedState = z.object({
  CurrentCloud: z
    .object({
      Lookup: z.string(),
      Name: z.string(),
    })
    .optional(),
  HasAzureConnection: z.boolean(),
});

export type ThinkyGettingStartedState = z.infer<
  typeof ThinkyGettingStartedState
>;

export class DefaultThinkyModifierHandlerResolver implements ModifierHandlerResolver {
  public async Resolve(ioc: IoCContainer, modifier: EaCModifierAsCode) {
    let resolver: EaCRuntimeHandler | undefined;

    if (modifier.Details?.Type === 'EaC') {
      resolver = async (_req, ctx) => {
        if (ctx.State.EnterpriseLookup) {
          const svc = await loadEaCSvc(ctx.State.JWT as string);

          const eac = (ctx.State.EaC = await svc.Get(
            ctx.State.EnterpriseLookup as string,
          ));

          if (eac) {
            ctx.State.GettingStarted = this.computeGettingStartedState(eac);
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

  protected computeGettingStartedState(
    eac: EverythingAsCodeClouds,
  ): ThinkyGettingStartedState {
    const cloudLookups = Object.keys(eac.Clouds || {});

    return {
      CurrentCloud: cloudLookups[0] && 'ID' in (eac.Clouds?.[cloudLookups[0]].Details || {})
        ? {
          Lookup: cloudLookups[0],
          Name: eac.Clouds![cloudLookups[0]].Details!.Name!,
        }
        : undefined,
      HasAzureConnection: false,
    } as ThinkyGettingStartedState;
  }
}
