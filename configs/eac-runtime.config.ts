import {
  DefaultEaCConfig,
  defineEaCConfig,
  EaCRuntime,
  FathymDemoPlugin,
} from '@fathym/eac/runtime';

export const config = defineEaCConfig({
  Plugins: [...(DefaultEaCConfig.Plugins || []), new FathymDemoPlugin()],
});

export function configure(_rt: EaCRuntime): Promise<void> {
  return Promise.resolve();
}
