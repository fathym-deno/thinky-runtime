// deno-lint-ignore-file no-explicit-any
import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac-runtime';
import { IoCContainer } from '@fathym/ioc';
import { EaCChatHistoryNeuron, EaCChatPromptNeuron } from '@fathym/synaptic';
import { DefaultThinkyProcessorHandlerResolver } from '../DefaultThinkyProcessorHandlerResolver.ts';
import z from 'npm:zod';
import { MessagesPlaceholder } from 'npm:@langchain/core/prompts';
import { BaseMessagePromptTemplateLike } from 'npm:@langchain/core/prompts';

export default class MinervaPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'MinervaPlugin',
      Plugins: [],
      EaC: {
        Circuits: {
          british: {
            Details: {
              Type: 'Linear',
              Name: 'basic-chat',
              Description: 'Used to have an open ended chat with you.',
              InputSchema: z.object({
                input: z.string().describe('The users new message.'),
              }),
              Priority: 100,
              Neurons: {
                '': {
                  Type: 'ChatHistory',
                  ChatHistoryLookup: `thinky|tester`,
                  InputKey: 'input',
                  HistoryKey: 'messages',
                  ChatNeuron: {
                    Type: 'ChatPrompt',
                    InputKey: 'question',
                    SystemMessage:
                      'You are a helpful, cauckney british assistant. Get pissed off if I ask you for the same thing, and reflect that in the new version of the answer.',
                    Messages: [
                      // ...baseMessages,
                      new MessagesPlaceholder('messages'),
                    ] as BaseMessagePromptTemplateLike[],
                    NewMessages: [['human', '{input}']],
                    Neurons: {
                      '': 'thinky-llm',
                    },
                  } as EaCChatPromptNeuron,
                } as EaCChatHistoryNeuron as any,
              },
            },
          },
        },
      },
      IoC: new IoCContainer(),
    };

    pluginConfig.IoC!.Register(DefaultThinkyProcessorHandlerResolver, {
      Type: pluginConfig.IoC!.Symbol('ProcessorHandlerResolver'),
    });

    return Promise.resolve(pluginConfig);
  }
}
