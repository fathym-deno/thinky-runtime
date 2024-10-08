import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac-runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCChatPromptNeuron,
  EaCCircuitNeuron,
  EaCGraphCircuitDetails,
  EaCLinearCircuitDetails,
  EaCToolExecutorNeuron,
} from '@fathym/synaptic';
import { MessagesPlaceholder } from '@langchain/core/prompts';
import { BaseMessagePromptTemplateLike } from '@langchain/core/prompts';
import { BaseMessage } from '@langchain/core/messages';
import { END, START } from '@langchain/langgraph';

export default class ThinkyEnterprisePlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyEnterprisePlugin',
      Plugins: [],
      EaC: {
        Circuits: {
          'ent-chat:agent': {
            Details: {
              Type: 'Linear',
              Priority: 100,
              Neurons: {
                '': {
                  Type: 'ChatPrompt',
                  SystemMessage: `You are a helpful assistant.`,
                  Messages: [
                    new MessagesPlaceholder('messages'),
                  ] as BaseMessagePromptTemplateLike[],
                  Neurons: {
                    '': 'thinky-llm-tooled',
                  },
                } as EaCChatPromptNeuron,
                // action: {},
              },
            } as EaCLinearCircuitDetails,
          },
          'ent-chat:action': {
            Details: {
              Type: 'Linear',
              Priority: 100,
              Neurons: {
                '': {
                  Type: 'ToolExecutor',
                  ToolLookups: ['thinky|tavily'],
                  MessagesPath: '$.messages',
                  BootstrapOutput(msgs: BaseMessage[]) {
                    return { messages: msgs };
                  },
                } as EaCToolExecutorNeuron,
                // action: {},
              },
            } as EaCLinearCircuitDetails,
          },
          'ent-chat': {
            Details: {
              Type: 'Graph',
              Priority: 100,
              State: {
                messages: {
                  value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
                  default: () => [],
                },
              },
              Neurons: {
                agent: {
                  Type: 'Circuit',
                  CircuitLookup: 'ent-chat:agent',
                } as EaCCircuitNeuron,
                action: {
                  Type: 'Circuit',
                  CircuitLookup: 'ent-chat:action',
                } as EaCCircuitNeuron,
              },
              Edges: {
                [START]: 'agent',
                agent: {
                  Node: {
                    continue: 'action',
                    end: END,
                  },
                  // Node: END,
                  Condition: (state: { messages: Array<BaseMessage> }) => {
                    const { messages } = state;

                    const lastMessage = messages[messages.length - 1];

                    let node = 'continue';

                    if (lastMessage) {
                      if (
                        (!('function_call' in lastMessage.additional_kwargs) ||
                          !lastMessage.additional_kwargs.function_call) &&
                        (!('tool_calls' in lastMessage.additional_kwargs) ||
                          !lastMessage.additional_kwargs.tool_calls)
                      ) {
                        node = 'end';
                      }
                    }

                    return node;
                  },
                },
                action: 'agent',
              },
            } as EaCGraphCircuitDetails,
          },
        },
      },
      IoC: new IoCContainer(),
    };

    return Promise.resolve(pluginConfig);
  }
}
