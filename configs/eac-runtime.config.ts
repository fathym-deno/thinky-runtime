import 'npm:html-to-text';
import {
  DefaultEaCConfig,
  defineEaCConfig,
  EaCRuntime,
} from '@fathym/eac/runtime';
import ThinkyRuntimePlugin from '../src/plugins/ThinkyRuntimePlugin.ts';

export const config = defineEaCConfig({
  Plugins: [...(DefaultEaCConfig.Plugins || []), new ThinkyRuntimePlugin()],
  Server: {
    port: 6132,
  },
});

export function configure(_rt: EaCRuntime): Promise<void> {
  return Promise.resolve();
}
