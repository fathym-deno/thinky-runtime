import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac/runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCChatPromptNeuron,
  EaCCircuitNeuron,
  EaCGraphCircuitDetails,
  EaCLinearCircuitDetails,
} from '@fathym/synaptic';
import z from 'npm:zod';
import { MessagesPlaceholder } from 'npm:@langchain/core/prompts';
import { BaseMessagePromptTemplateLike } from 'npm:@langchain/core/prompts';
import { BaseMessage, HumanMessage } from 'npm:@langchain/core/messages';
import { END, START } from 'npm:@langchain/langgraph';
import { RunnableLambda } from 'npm:@langchain/core/runnables';
import { RunnablePassthrough } from '../../../../synaptic/src/src.deps.ts';

export default class ThinkyPublicPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyPublicPlugin',
      Plugins: [],
      EaC: {
        $neurons: {},
        Circuits: {
          'thinky-public:open-chat': {
            Details: {
              Type: 'Graph',
              Priority: 100,
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
                  SystemMessage:
                    `You are a friendly assistant for Fathym, named Thinky. Please answer the user's question to the best of your ability.`,
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
                      }),
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
                  SystemMessage:
                    `You are a friendly greeter for Fathym, named Thinky. Please greet the user in two messages. Each message should be short and to the point, and your response should be in Markdown, without the use of any Markdown titles, just your chat responses represented as Markdown.  The 2 messages will greet the user, and ask them to sign in/sign up at \`/dashboard\`, with NO origin/host domain, just the relative path.
                  
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
- If you provide the oriign/host domain, and not just (sign up or sign in)['/dashboard'], then you and I are gonna have a problem.
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
              PersistenceLookup: 'thinky|thinky-public',
              State: {
                Messages: {
                  value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
                  default: () => [],
                },
                Welcomed: {
                  value: false,
                },
              },
              Neurons: {
                'open-chat': {
                  Type: 'Circuit',
                  CircuitLookup: 'thinky-public:open-chat',
                } as EaCCircuitNeuron,
                'welcome-chat': {
                  Type: 'Circuit',
                  CircuitLookup: 'thinky-public:welcome-chat',
                  Bootstrap: (r) =>
                    RunnablePassthrough.assign({
                      IsNewUser: () => true,
                      Username: () => '',
                    })
                      .pipe(r)
                      .pipe(
                        RunnablePassthrough.assign({
                          Messages: (msg) => [msg],
                          Welcomed: () => true,
                        }),
                      ),
                } as EaCCircuitNeuron,
              },
              Edges: {
                [START]: {
                  Node: {
                    open: 'open-chat',
                    welcome: 'welcome-chat',
                  },
                  Condition: (state: { Welcomed: boolean }) => {
                    return state.Welcomed ? 'open' : 'welcome';
                  },
                },
                'welcome-chat': END,
                'open-chat': END,
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
