import { EaCRuntimeHandlers } from '@fathym/eac-runtime';

export default {
  GET(_req, _ctx) {
    return Response.json({ Hello: 'World' });
  },
} as EaCRuntimeHandlers;
