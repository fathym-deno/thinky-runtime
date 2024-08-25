import { EaCRuntimeConfig, EaCRuntimePlugin, EaCRuntimePluginConfig } from '@fathym/eac-runtime';
import { IoCContainer } from '@fathym/ioc';
import {
  EaCChatPromptNeuron,
  EaCCircuitNeuron,
  EaCDenoKVSaverPersistenceDetails,
  EaCGraphCircuitDetails,
  EaCLinearCircuitDetails,
} from '@fathym/synaptic';
import z from 'npm:zod';
import { BaseMessagePromptTemplateLike } from 'npm:@langchain/core/prompts';
import { AIMessage, AIMessageChunk, BaseMessage, HumanMessage } from 'npm:@langchain/core/messages';
import { END, START } from 'npm:@langchain/langgraph';
import { EverythingAsCode } from '@fathym/eac';
import ThinkyGettingStartedPlugin from './ThinkyGettingStartedPlugin.ts';

export const ThinkyDashboardInputSchema = z.object({
  Input: z.string().optional(),
});

export type ThinkyDashboardInputSchema = z.infer<
  typeof ThinkyDashboardInputSchema
>;

export type ThinkyDashboardState = {
  EaC?: EverythingAsCode;

  EnterpriseLookup?: string;

  GotStarted?: boolean;

  Messages?: BaseMessage[];
};

export default class ThinkyDashboardPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(_config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyDashboardPlugin',
      Plugins: [new ThinkyGettingStartedPlugin()],
      EaC: {
        $neurons: {},
        AIs: {
          thinky: {
            Persistence: {
              'thinky-dashboard': {
                Details: {
                  Type: 'DenoKVSaver',
                  DatabaseLookup: 'thinky',
                  RootKey: ['Thinky', 'Dashboard', 'Main'],
                  CheckpointTTL: 1 * 1000 * 60 * 60 * 24 * 7, // 7 Days
                } as EaCDenoKVSaverPersistenceDetails,
              },
            },
          },
        },
        Circuits: {
          'thinky-dashboard:getting-started': this.buildGettingStartedCircuit(),
          'thinky-dashboard': this.buildDashboardCircuit(),
        },
      },
      IoC: new IoCContainer(),
    };

    return Promise.resolve(pluginConfig);
  }

  protected buildDashboardCircuit() {
    return {
      Details: {
        Type: 'Graph',
        Priority: 100,
        InputSchema: ThinkyDashboardInputSchema,
        PersistenceLookup: 'thinky|thinky-dashboard',
        State: {
          Messages: {
            value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
            default: () => [],
          },
          GotStarted: {
            value: (_x: boolean, y: boolean) => y,
          },
        },
        Neurons: {
          'getting-started': {
            Type: 'Circuit',
            CircuitLookup: 'thinky-dashboard:getting-started',
          } as EaCCircuitNeuron,
        },
        Edges: {
          [START]: {
            Node: {
              [END]: END,
              'getting-started': 'getting-started',
            },
            Condition: (state: ThinkyDashboardState) => {
              const lastMsg = state.Messages?.slice(-1)[0];

              const node = state.GotStarted ? END : !lastMsg ||
                  !(
                    lastMsg instanceof AIMessage ||
                    lastMsg instanceof AIMessageChunk
                  )
                ? 'getting-started'
                : END;

              return node;
            },
          },
          'getting-started': END,
        },
        BootstrapInput({ Input }: ThinkyDashboardInputSchema) {
          return {
            Messages: Input ? [new HumanMessage(Input)] : [],
          };
        },
      } as EaCGraphCircuitDetails,
    };
  }

  protected buildGettingStartedCircuit() {
    return {
      Details: {
        Type: 'Linear',
        Priority: 100,
        Neurons: {
          '': {
            Type: 'ChatPrompt',
            SystemMessage:
              `You are here to explain to the user that the best place to start for a new enterprise, is the getting started workflow. Provide your response as Markdown, without any titles, just your responses as markdown. Make sure to provide a link to the getting started workflow at the exact path \`/dashboard/getting-started\`. It must be the absolute path, with no host/origin for things to work correctly. Markdwon example would be \`[...]('/dashboard/getting-started')\``,
            NewMessages: [
              new HumanMessage('Hi'),
            ] as BaseMessagePromptTemplateLike[],
            Neurons: {
              '': 'thinky-llm',
            },
            BootstrapOutput(msg: BaseMessage) {
              return {
                Messages: [msg],
              };
            },
          } as EaCChatPromptNeuron,
        },
      } as EaCLinearCircuitDetails,
    };
  }
}
