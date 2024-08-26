import { EaCJWTValidationModifierDetails, EaCRedirectProcessor } from '@fathym/eac/applications';
import { EaCDenoKVDatabaseDetails } from '@fathym/eac/databases';
import { EaCAzureADB2CProviderDetails, EaCAzureADProviderDetails } from '@fathym/eac/identity';
import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
  FathymAzureContainerCheckPlugin,
  FathymDFSFileHandlerPlugin,
  FathymEaCServicesPlugin,
} from '@fathym/eac-runtime';
import { IoCContainer } from '@fathym/ioc';
import { EaCSynapticCircuitsProcessor, FathymSynapticPlugin } from '@fathym/synaptic';
import { DefaultThinkyProcessorHandlerResolver } from './DefaultThinkyProcessorHandlerResolver.ts';
import ThinkyPlugin from './ThinkyPlugin.ts';
import { DefaultThinkyModifierHandlerResolver } from './DefaultThinkyModifierHandlerResolver.ts';
import ThinkyMSALPlugin from './ThinkyMSALPlugin.ts';
import { EaCMSALProcessor } from '@fathym/msal';

export default class ThinkyRuntimePlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'ThinkyPlugin',
      Plugins: [
        new FathymAzureContainerCheckPlugin(),
        new FathymEaCServicesPlugin(),
        new FathymDFSFileHandlerPlugin(),
        new ThinkyPlugin(),
        new FathymSynapticPlugin(),
        new ThinkyMSALPlugin(),
      ],
      EaC: {
        Projects: {
          thinky: {
            Details: {
              Name: 'Thinky',
              Description: 'The Thinky AI logic and APIs.',
              Priority: 100,
            },
            ResolverConfigs: {
              localhost: {
                Hostname: 'localhost',
                Port: config?.Server?.port || 8000,
              },
              '127.0.0.1': {
                Hostname: '127.0.0.1',
                Port: config?.Server?.port || 8000,
              },
              'host.docker.internal': {
                Hostname: 'host.docker.internal',
                Port: config.Server.port || 8000,
              },
              'thinky-runtime.fathym.com': {
                Hostname: 'thinky-runtime.fathym.com',
              },
              'thinky-runtime.azurewebsites.net': {
                Hostname: 'thinky-runtime.azurewebsites.net',
              },
            },
            ModifierResolvers: {},
            ApplicationResolvers: {
              circuits: {
                PathPattern: '/circuits*',
                Priority: 300,
              },
              msal: {
                PathPattern: '/connect/azure/*',
                Priority: 500,
              },
              'public-circuits': {
                PathPattern: '/public-circuits*',
                Priority: 300,
              },
              root: {
                PathPattern: '*',
                Priority: 100,
              },
            },
          },
        },
        Applications: {
          circuits: {
            Details: {
              Name: 'Circuits',
              Description: 'The API for accessing circuits',
            },
            ModifierResolvers: {
              jwtValidate: {
                Priority: 900,
              },
              eac: {
                Priority: 500,
              },
            },
            Processor: {
              Type: 'SynapticCircuits',
              // Excludes: ['ent-chat:agent', 'ent-chat:action'],
              Includes: ['thinky-dashboard', 'thinky-getting-started'],
            } as EaCSynapticCircuitsProcessor,
          },
          msal: {
            Details: {
              Name: 'OAuth Site',
              Description: 'The site for use in OAuth workflows for a user',
            },
            Processor: {
              Type: 'MSAL',
              Config: {
                MSALSignInOptions: {
                  Scopes: [
                    'https://management.core.windows.net//user_impersonation',
                  ], // Your desired scopes go here
                  RedirectURI: '/dashboard/thinky/connect/azure/callback',
                  SuccessRedirect: '/dashboard',
                },
                MSALSignOutOptions: {
                  ClearSession: false,
                  PostLogoutRedirectUri: '/',
                },
              },
              ProviderLookup: 'azure',
            } as EaCMSALProcessor,
          },
          'public-circuits': {
            Details: {
              Name: 'Public Circuits',
              Description: 'The API for accessing public circuits',
            },
            ModifierResolvers: {},
            Processor: {
              Type: 'SynapticCircuits',
              // Excludes: ['ent-chat:agent', 'ent-chat:action'],
              Includes: ['thinky-public'],
            } as EaCSynapticCircuitsProcessor,
          },
          root: {
            Processor: {
              Type: 'Redirect',
              Redirect: 'https://www.fathym.com',
            } as EaCRedirectProcessor,
          },
        },
        Modifiers: {
          eac: {
            Details: {
              Type: 'EaC',
            },
          },
          jwtValidate: {
            Details: {
              Type: 'JWTValidation',
              Name: 'Validate JWT',
              Description: 'Validate incoming JWTs to restrict access.',
            } as EaCJWTValidationModifierDetails,
          },
        },
        Databases: {
          cache: {
            Details: {
              Type: 'DenoKV',
              Name: 'Local Cache',
              Description: 'The Deno KV database to use for local caching.',
              DenoKVPath: Deno.env.get('LOCAL_CACHE_DENO_KV_PATH') || undefined,
            } as EaCDenoKVDatabaseDetails,
          },
          eac: {
            Details: {
              Type: 'DenoKV',
              Name: 'EaC',
              Description: 'The Deno KV database to use for EaC',
              DenoKVPath: Deno.env.get('EAC_DENO_KV_PATH') || undefined,
            } as EaCDenoKVDatabaseDetails,
          },
          oauth: {
            Details: {
              Type: 'DenoKV',
              Name: 'OAuth',
              Description: 'The Deno KV database to use for EaC',
              DenoKVPath: Deno.env.get('OAUTH_DENO_KV_PATH') || undefined,
            } as EaCDenoKVDatabaseDetails,
          },
          thinky: {
            Details: {
              Type: 'DenoKV',
              Name: 'Thinky',
              Description: 'The Deno KV database to use for thinky',
              DenoKVPath: Deno.env.get('THINKY_DENO_KV_PATH') || undefined,
            } as EaCDenoKVDatabaseDetails,
          },
        },
        Providers: {
          adb2c: {
            DatabaseLookup: 'oauth',
            Details: {
              Name: 'Azure ADB2C OAuth Provider',
              Description: 'The provider used to connect with our azure adb2c instance',
              ClientID: Deno.env.get('AZURE_ADB2C_CLIENT_ID')!,
              ClientSecret: Deno.env.get('AZURE_ADB2C_CLIENT_SECRET')!,
              Scopes: ['openid', Deno.env.get('AZURE_ADB2C_CLIENT_ID')!],
              Domain: Deno.env.get('AZURE_ADB2C_DOMAIN')!,
              PolicyName: Deno.env.get('AZURE_ADB2C_POLICY')!,
              TenantID: Deno.env.get('AZURE_ADB2C_TENANT_ID')!,
              IsPrimary: true,
            } as EaCAzureADB2CProviderDetails,
          },
          azure: {
            DatabaseLookup: 'oauth',
            Details: {
              Name: 'Azure OAuth Provider',
              Description: 'The provider used to connect with Azure',
              ClientID: Deno.env.get('AZURE_AD_CLIENT_ID')!,
              ClientSecret: Deno.env.get('AZURE_AD_CLIENT_SECRET')!,
              Scopes: ['openid'],
              TenantID: Deno.env.get('AZURE_AD_TENANT_ID')!, //common
            } as EaCAzureADProviderDetails,
          },
        },
      },
      IoC: new IoCContainer(),
    };

    pluginConfig.IoC!.Register(DefaultThinkyModifierHandlerResolver, {
      Type: pluginConfig.IoC!.Symbol('ModifierHandlerResolver'),
    });

    pluginConfig.IoC!.Register(DefaultThinkyProcessorHandlerResolver, {
      Type: pluginConfig.IoC!.Symbol('ProcessorHandlerResolver'),
    });

    return Promise.resolve(pluginConfig);
  }
}
