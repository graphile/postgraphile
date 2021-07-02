import { AddFlagFn } from './cli';
import { Server, IncomingMessage } from 'http';
import {
  CreateRequestHandlerOptions,
  HttpRequestHandler,
  PostGraphileOptions,
} from '../interfaces';
import { WithPostGraphileContextFn } from './withPostGraphileContext';
// @ts-ignore Allow importing JSON
import { version } from '../../package.json';
import * as WebSocket from 'ws';
import * as graphql from 'graphql';
import * as graphqlWs from 'graphql-ws';
import { Extra as GraphQLWSContextExtra } from 'graphql-ws/lib/use/ws';
import { ServerOptions, ExecutionParams } from 'subscriptions-transport-ws';
import { PostGraphileResponse } from './http/frameworks';

type PromiseOrValue<T> = T | Promise<T>;

// tslint:disable-next-line no-any
export type HookFn<TArg, TContext = any> = (arg: TArg, context: TContext) => TArg;
export type PluginHookFn = <TArgument, TContext = Record<string, any>>(
  hookName: string,
  argument: TArgument,
  context?: TContext,
) => TArgument;

export interface PostGraphileHTTPResult {
  statusCode?: number;
  result?: Record<string, any>;
  errors?: Array<Record<string, any>>;
  meta?: Record<string, any>;
}
export interface PostGraphileHTTPEnd {
  statusCode?: number;
  result: Record<string, any> | Array<Record<string, any>>;
}
export interface PostGraphilePlugin {
  init?: HookFn<null, { version: string; graphql: typeof import('graphql') }>;

  pluginHook?: HookFn<PluginHookFn>;

  'cli:flags:add:standard'?: HookFn<AddFlagFn>;
  'cli:flags:add:schema'?: HookFn<AddFlagFn>;
  'cli:flags:add:errorHandling'?: HookFn<AddFlagFn>;
  'cli:flags:add:plugins'?: HookFn<AddFlagFn>;
  'cli:flags:add:noServer'?: HookFn<AddFlagFn>;
  'cli:flags:add:webserver'?: HookFn<AddFlagFn>;
  'cli:flags:add:jwt'?: HookFn<AddFlagFn>;
  'cli:flags:add'?: HookFn<AddFlagFn>;
  'cli:flags:add:deprecated'?: HookFn<AddFlagFn>;
  'cli:flags:add:workarounds'?: HookFn<AddFlagFn>;
  // tslint:disable-next-line no-any
  'cli:library:options'?: HookFn<PostGraphileOptions, { config: any; cliOptions: any }>;
  'cli:server:middleware'?: HookFn<HttpRequestHandler>;
  'cli:server:created'?: HookFn<Server>;
  'cli:greeting'?: HookFn<Array<string | null | void>>;

  'postgraphile:options'?: HookFn<PostGraphileOptions>;
  'postgraphile:validationRules:static'?: HookFn<typeof graphql.specifiedRules>;
  'postgraphile:graphiql:html'?: HookFn<string>;

  // Wrap the middleware:
  'postgraphile:middleware'?: HookFn<HttpRequestHandler>;

  // Inside the middleware:
  'postgraphile:http:handler'?: HookFn<IncomingMessage>;

  // Inside the route handlers (including via middleware):
  'postgraphile:http:eventStreamRouteHandler'?: HookFn<
    IncomingMessage,
    { options: CreateRequestHandlerOptions; response: PostGraphileResponse }
  >;
  'postgraphile:http:faviconRouteHandler'?: HookFn<
    IncomingMessage,
    { options: CreateRequestHandlerOptions; response: PostGraphileResponse }
  >;
  'postgraphile:http:graphiqlRouteHandler'?: HookFn<
    IncomingMessage,
    { options: CreateRequestHandlerOptions; response: PostGraphileResponse }
  >;
  'postgraphile:http:graphqlRouteHandler'?: HookFn<
    IncomingMessage,
    { options: CreateRequestHandlerOptions; response: PostGraphileResponse }
  >;

  // Deep inside the graphqlRouteHandler (including via middleware)
  'postgraphile:http:result'?: HookFn<PostGraphileHTTPResult>;
  'postgraphile:http:end'?: HookFn<PostGraphileHTTPEnd>;
  'postgraphile:httpParamsList'?: HookFn<Array<Record<string, any>>>;

  'postgraphile:validationRules'?: HookFn<typeof graphql.specifiedRules>; // AVOID THIS where possible; use 'postgraphile:validationRules:static' instead.

  'postgraphile:ws:graphqlWs:options'?: HookFn<
    graphqlWs.ServerOptions<GraphQLWSContextExtra>,
    {
      websocketServer: WebSocket.Server;
      postgraphileMiddleware: HttpRequestHandler;
      subscriptionServerOptions?: {
        keepAlive?: number;
        graphqlRoute?: string;
      };
    }
  >;
  'postgraphile:ws:subscriptionsTransportWs:options'?: HookFn<
    ServerOptions,
    {
      websocketServer: WebSocket.Server;
      postgraphileMiddleware: HttpRequestHandler;
      subscriptionServerOptions?: {
        keepAlive?: number;
        graphqlRoute?: string;
      };
    }
  >;

  'postgraphile:ws:onOperation'?: HookFn<ExecutionParams>;
  'postgraphile:ws:onSubscribe'?: HookFn<
    graphql.ExecutionArgs & {
      document: graphql.DocumentNode | null; // optional for persisted query support
    },
    {
      context: graphqlWs.Context<GraphQLWSContextExtra>;
      message: graphqlWs.SubscribeMessage;
      options: CreateRequestHandlerOptions;
    }
  >;

  'postgraphile:liveSubscribe:executionResult'?: HookFn<
    PromiseOrValue<
      graphql.ExecutionResult<
        {
          [key: string]: any;
        },
        {
          [key: string]: any;
        }
      >
    >,
    {
      schema: graphql.GraphQLSchema;
      document: graphql.DocumentNode;
      rootValue: any;
      contextValue: any;
      variableValues: { [key: string]: any } | undefined;
      operationName: string | undefined;
      fieldResolver: graphql.GraphQLFieldResolver<any, any, { [argName: string]: any }> | undefined;
      subscribeFieldResolver:
        | graphql.GraphQLFieldResolver<any, any, { [argName: string]: any }>
        | undefined;
    }
  >;

  withPostGraphileContext?: HookFn<WithPostGraphileContextFn>;
}
type HookName = keyof PostGraphilePlugin;

const identityHook = <T>(input: T): T => input;
const identityPluginHook: PluginHookFn = (_hookName, input, _options) => input;

function contextIsSame(context1: Record<string, any>, context2: Record<string, any>): boolean {
  // Shortcut if obvious
  if (context1 === context2) {
    return true;
  }
  // Blacklist approach from now on
  const keys1 = Object.keys(context1);
  const keys2 = Object.keys(context2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  // tslint:disable-next-line one-variable-per-declaration
  for (let i = 0, l = keys1.length; i < l; i++) {
    const key = keys1[i];
    if (context1[key] !== context2[key]) {
      return false;
    }
    if (!keys2.includes(key)) {
      return false;
    }
  }

  return true;
}

// Caches the last value of the hook, in case it's called with exactly the same
// arguments again.
function memoizeHook<T>(hook: HookFn<T>): HookFn<T> {
  let lastCall: {
    argument: T;
    context: Record<string, any>;
    result: T;
  } | null = null;
  return (argument: T, context: Record<string, any>): T => {
    if (lastCall && lastCall.argument === argument && contextIsSame(lastCall.context, context)) {
      return lastCall.result;
    } else {
      const result = hook(argument, context);
      lastCall = {
        argument,
        context,
        result,
      };
      return result;
    }
  };
}

function shouldMemoizeHook(hookName: HookName) {
  return hookName === 'withPostGraphileContext';
}

function makeHook<T>(plugins: Array<PostGraphilePlugin>, hookName: HookName): HookFn<T> {
  const combinedHook = plugins.reduce((previousHook: HookFn<T>, plugin: Record<string, any>) => {
    if (typeof plugin[hookName] === 'function') {
      return (argument: T, context: Record<string, any>) => {
        return plugin[hookName](previousHook(argument, context), context);
      };
    } else {
      return previousHook;
    }
  }, identityHook);
  if (combinedHook === identityHook) {
    return identityHook;
  } else if (shouldMemoizeHook(hookName)) {
    return memoizeHook<T>(combinedHook);
  } else {
    return combinedHook;
  }
}

export function makePluginHook(plugins: Array<PostGraphilePlugin>): PluginHookFn {
  const hooks = {};
  const emptyObject = {}; // caching this makes memoization faster when no context is needed
  function rawPluginHook<T>(
    hookName: HookName,
    argument: T,
    context: Record<string, any> = emptyObject,
  ): T {
    if (!hooks[hookName]) {
      hooks[hookName] = makeHook(plugins, hookName);
    }
    return hooks[hookName](argument, context);
  }

  const pluginHook: PluginHookFn = rawPluginHook('pluginHook', rawPluginHook, {});
  // Use this hook to check your hook is compatible with this version of
  // PostGraphile, also to get a reference to shared graphql instance.
  pluginHook('init', null, { version, graphql });
  return pluginHook;
}

export function pluginHookFromOptions(options: PostGraphileOptions): PluginHookFn {
  if (typeof options.pluginHook === 'function') {
    return options.pluginHook;
  } else {
    return identityPluginHook;
  }
}
