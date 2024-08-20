import { EaCRuntimeHandler } from '@fathym/eac-runtime';

export default ((_req, ctx) => {
  console.log(
    '************************* > Sub MIDDLEWARE *************************',
  );

  const resp = ctx.Next();

  console.log(
    '************************* Sub MIDDLEWARE > *************************',
  );

  return resp;
}) as EaCRuntimeHandler;
