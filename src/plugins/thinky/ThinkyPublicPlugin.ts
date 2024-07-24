import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
} from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCChatPromptNeuron,
  EaCCircuitNeuron,
  EaCDenoKVSaverPersistenceDetails,
  EaCGraphCircuitDetails,
  EaCLinearCircuitDetails,
} from '@fathym/synaptic';
import z from 'npm:zod';
import { MessagesPlaceholder } from 'npm:@langchain/core/prompts';
import { BaseMessagePromptTemplateLike } from 'npm:@langchain/core/prompts';
import {
  BaseMessage,
  HumanMessage,
  HumanMessageChunk,
} from 'npm:@langchain/core/messages';
import { END, START } from 'npm:@langchain/langgraph';
import { RunnableLambda } from 'npm:@langchain/core/runnables';

export default class ThinkyPublicPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyPublicPlugin',
      Plugins: [],
      EaC: {
        $neurons: {},
        AIs: {
          thinky: {
            Persistence: {
              'thinky-public:open-chat': {
                Details: {
                  Type: 'DenoKVSaver',
                  DatabaseLookup: 'thinky',
                  RootKey: ['Thinky', 'Public', 'Open', 'Chat'],
                  CheckpointTTL: 1 * 1000 * 60 * 60 * 24 * 7, // 7 Days
                } as EaCDenoKVSaverPersistenceDetails,
              },
              'thinky-public': {
                Details: {
                  Type: 'DenoKVSaver',
                  DatabaseLookup: 'thinky',
                  RootKey: ['Thinky', 'Public', 'Main'],
                  CheckpointTTL: 1 * 1000 * 60 * 60 * 24 * 7, // 7 Days
                } as EaCDenoKVSaverPersistenceDetails,
              },
            },
          },
        },
        Circuits: {
          'thinky-public:open-chat': {
            Details: {
              Type: 'Graph',
              Priority: 100,
              // PersistenceLookup: 'thinky|memory',
              PersistenceLookup: 'thinky|thinky-public:open-chat',
              State: {
                Messages: {
                  value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
                  default: () => [],
                },
              },
              Neurons: {
                agent: {
                  Type: 'ChatPrompt',
                  SystemMessage: `You are a friendly assistant for Fathym, named Thinky. Please answer the user's question to the best of your ability.`,
                  NewMessages: [
                    new MessagesPlaceholder('Messages'),
                  ] as BaseMessagePromptTemplateLike[],
                  Neurons: {
                    '': 'thinky-llm',
                  },
                  Bootstrap: (r) =>
                    r.pipe(
                      RunnableLambda.from((msg: BaseMessage) => {
                        return {
                          Messages: [msg],
                        };
                      })
                    ),
                } as EaCChatPromptNeuron,
              },
              Edges: {
                [START]: 'agent',
                agent: END,
              },
            } as EaCGraphCircuitDetails,
          },
          'thinky-public:welcome-chat': {
            Details: {
              Type: 'Linear',
              Priority: 100,
              Neurons: {
                '': {
                  Type: 'ChatPrompt',
                  SystemMessage: `You are a friendly greeter for Fathym, named Thinky. Please greet the user in two messages. Each message should be short and to the point, and your response should be in Markdown, without the use of any Markdown titles, just your chat responses represented as Markdown.  The 2 messages will greet the user, and ask them to sign in/sign up at \`/dashboard\`, with NO origin/host domain, just the relative path.
                  
Messages:
1) The first message should 'welcome' the user as a new or existing user, and should use the users name if provided. It should provide a quick blurb about how you, Thinky, will be here to help them on their 'development journey'. Use the Ocotpus emoji at the end.
2) The second message MUST ask the user to sign up or sign in, with a link to exactly the path '[...](/dashboard)', and should let the user know they can ask questions about Fathym to learn more. Again, make sure the link is to exactly \`/dashboard\`, with NO origin/host domain, just the relative path.
                  
User Information: 
{{
  IsNewUser: {IsNewUser},
  Username: {Username}
}}

Example, New User:
Hey there! Welcome to Fathym! I'm Thinky, and I'll be here to help you on your development journey. 🐙

To get started, please [sign up or sign in](/dashboard). If you have any questions about Fathym, feel free to ask!

Notes: 
- If you provide the oriign/host domain, and not just [sign up or sign in]('/dashboard'), then you and I are gonna have a problem.
`,
                  NewMessages: [
                    new HumanMessage('Hi'),
                  ] as BaseMessagePromptTemplateLike[],
                  Neurons: {
                    '': 'thinky-llm',
                  },
                } as EaCChatPromptNeuron,
              },
            } as EaCLinearCircuitDetails,
          },
          'thinky-public': {
            Details: {
              Type: 'Graph',
              Priority: 100,
              InputSchema: z.object({
                Input: z.string().optional(),
              }),
              // PersistenceLookup: 'thinky|memory',
              PersistenceLookup: 'thinky|thinky-public',
              State: {
                Messages: {
                  value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
                  default: () => [],
                },
                Welcomed: {
                  value: (_x: boolean, y: boolean) => y,
                },
              },
              Neurons: {
                'open-chat': {
                  Type: 'Circuit',
                  CircuitLookup: 'thinky-public:open-chat',
                  BootstrapInput({
                    Messages: msgs,
                  }: {
                    Messages: BaseMessage[];
                  }) {
                    return {
                      Messages: msgs?.slice(-1) || [],
                    };
                  },
                  BootstrapOutput({
                    Messages: msgs,
                  }: {
                    Messages: BaseMessage[];
                  }) {
                    return {
                      Messages: msgs?.slice(-1) || [],
                    };
                  },
                } as EaCCircuitNeuron,
                'welcome-chat': {
                  Type: 'Circuit',
                  CircuitLookup: 'thinky-public:welcome-chat',
                  BootstrapInput() {
                    return {
                      IsNewUser: true,
                      Username: '',
                    };
                  },
                  BootstrapOutput(msg: BaseMessage) {
                    return {
                      Messages: [msg],
                      Welcomed: true,
                    };
                  },
                } as EaCCircuitNeuron,
              },
              Edges: {
                [START]: {
                  Node: {
                    [END]: END,
                    open: 'open-chat',
                    welcome: 'welcome-chat',
                  },
                  Condition: (state: {
                    Messages: BaseMessage[];
                    Welcomed: boolean;
                  }) => {
                    const lastMsg = state.Messages?.slice(-1)[0];

                    const node = state.Welcomed
                      ? lastMsg &&
                        (lastMsg instanceof HumanMessage ||
                          lastMsg instanceof HumanMessageChunk)
                        ? 'open'
                        : END
                      : 'welcome';

                    return node;
                  },
                },
                'welcome-chat': END,
                'open-chat': END,
              },
              Bootstrap: (r) =>
                RunnableLambda.from(({ Input }: { Input: string }) => {
                  return {
                    Messages: Input ? [new HumanMessage(Input)] : [],
                  };
                })
                  .pipe(r)
                  .pipe(
                    RunnableLambda.from(
                      (state: { Messages: BaseMessage[] }) => {
                        return state;
                      }
                    )
                  ),
            } as EaCGraphCircuitDetails,
          },
        },
      },
      IoC: new IoCContainer(),
    };

    return Promise.resolve(pluginConfig);
  }
}
