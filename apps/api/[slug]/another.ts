import { EaCRuntimeHandlers } from '@fathym/eac-runtime';

export default {
  GET(_req, ctx) {
    return Response.json({ Hello: `World${ctx.Params.slug}Another` });
  },
} as EaCRuntimeHandlers;
