import { EaCRuntimeHandler } from '@fathym/eac/runtime';

export default [
  (_req, ctx) => {
    console.log('************************* > MIDDLEWARE *************************');

    const resp = ctx.Next();

    console.log('************************* MIDDLEWARE > *************************');

    return resp;
  },

  (_req, ctx) => {
    console.log('************************* > MIDDLEWARE 2 *************************');

    const resp = ctx.Next();

    console.log('************************* MIDDLEWARE 2 > *************************');

    return resp;
  },
] as EaCRuntimeHandler[];
