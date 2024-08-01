import * as _azureSearch from 'npm:@azure/search-documents';
import * as _parse from 'npm:pdf-parse';
import * as _htmlToText from 'npm:html-to-text';
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
