// deno-lint-ignore-file no-explicit-any
import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCChatHistoryNeuron,
  EaCChatPromptNeuron,
  EaCGraphCircuitDetails,
  EaCLinearCircuitDetails,
  EaCLLMNeuron,
} from '@fathym/synaptic';
import z from 'npm:zod';
import { MessagesPlaceholder } from 'npm:@langchain/core/prompts';
import { BaseMessagePromptTemplateLike } from 'npm:@langchain/core/prompts';
import MinervaPlugin from './thinky/MinervaPlugin.ts';
import { END, START } from 'npm:@langchain/langgraph';
import ThinkyEnterprisePlugin from './thinky/ThinkyEnterprisePlugin.ts';
import ThinkyPublicPlugin from './thinky/ThinkyPublicPlugin.ts';

export default class ThinkyPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyPlugin',
      Plugins: [
        new ThinkyPublicPlugin(),
        new ThinkyEnterprisePlugin(),
        new MinervaPlugin(),
      ],
      EaC: {
        Circuits: {
          $neurons: {
            'thinky-llm': {
              Type: 'LLM',
              LLMLookup: `thinky|thinky`,
            } as EaCLLMNeuron as any,
            'thinky-llm-tooled': {
              Type: 'LLM',
              LLMLookup: `thinky|thinky-tooled`,
            } as EaCLLMNeuron as any,
          },
          $remotes: {
            // 'remote-test': 'http://localhost:6131/circuits/'
          },
          'graph-chat-model': {
            Details: {
              Type: 'Graph',
              Priority: 100,
              Neurons: {
                main: 'thinky-llm',
              },
              Edges: {
                [START]: 'main',
                main: END,
              },
            } as EaCGraphCircuitDetails,
          },
          chat: {
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
                  Neurons: {
                    '': {
                      Type: 'ChatPrompt',
                      InputKey: 'question',
                      SystemMessage:
                        'You are a helpful, pirate assistant. Get pissed off if I ask you for the same thing, and reflect that in the new version of the answer.',
                      Messages: [
                        // ...baseMessages,
                        new MessagesPlaceholder('messages'),
                      ] as BaseMessagePromptTemplateLike[],
                      NewMessages: [['human', '{input}']],
                      Neurons: {
                        '': 'thinky-llm',
                      },
                    } as EaCChatPromptNeuron,
                  },
                } as EaCChatHistoryNeuron,
              },
            } as EaCLinearCircuitDetails,
          },
        },
      },
      IoC: new IoCContainer(),
    };

    return Promise.resolve(pluginConfig);
  }
}
