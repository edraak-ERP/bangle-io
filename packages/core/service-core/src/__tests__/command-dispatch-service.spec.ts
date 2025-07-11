import {
  BaseError,
  BaseService,
  type BaseServiceContext,
} from '@bangle.io/base-utils';
import { commandKeyToContext } from '@bangle.io/constants';
import { T } from '@bangle.io/mini-js-utils';
import { makeTestCommonOpts } from '@bangle.io/test-utils';
import type {
  Command,
  CommandDispatchResult,
  CommandExposedServices,
  CommandHandler,
  CommandHandlerContext,
  CommandKey,
} from '@bangle.io/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { CommandDispatchService } from '../command-dispatch-service';
import { CommandRegistryService } from '../command-registry-service';

class TestService extends BaseService {
  constructor(
    context: BaseServiceContext,
    private dependencies: null,
  ) {
    super('file-system-test', context, null);
  }

  hookMount() {
    // noop
  }
}

function getCtx(key: CommandKey<string>) {
  const result = commandKeyToContext.get(key);
  if (!result) {
    throw new BaseError({
      message: `Command "${key.key}" is not registered.`,
    });
  }
  return {
    dispatch: result.context.dispatch,
    store: result.context.store,
  } satisfies CommandHandlerContext;
}

async function setup() {
  const { commonOpts, mockLog, controller } = makeTestCommonOpts();
  const logger = commonOpts.logger;
  const context = {
    ctx: commonOpts,
    serviceContext: {
      abortSignal: commonOpts.rootAbortSignal,
    },
  };
  const commandRegistry = new CommandRegistryService(context, null, {
    commands: [],
    commandHandlers: [],
  });

  const dispatchedCommands: CommandDispatchResult[] = [];

  const dispatchService = new CommandDispatchService(
    context,
    {
      commandRegistry,
    },
    {
      emitResult: (result) => {
        dispatchedCommands.push(result);
      },
      focusEditor: () => {},
    },
  );

  dispatchService.exposedServices = {
    fileSystem: new TestService(context, null),
  } as unknown as CommandExposedServices;

  await dispatchService.mount();
  return {
    logger,
    commandRegistry,
    dispatchService,
    mockLog: mockLog,
    dispatchedCommands,
    controller,
  };
}

describe('CommandDispatchService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should dispatch a command successfully', async () => {
    const { mockLog, commandRegistry, dispatchService, dispatchedCommands } =
      await setup();
    const command = {
      id: 'command::ui:toggle-sidebar',
      keywords: ['test', 'command'],
      dependencies: { services: ['fileSystem'] },
      omniSearch: true,
      args: null,
    } as const satisfies Command;

    const handler = vi.fn();

    commandRegistry.register(command);
    commandRegistry.registerHandler({
      id: 'command::ui:toggle-sidebar',
      handler,
    });

    dispatchService.dispatch('command::ui:toggle-sidebar', null, 'testSource');

    expect(handler).toHaveBeenCalledWith(
      {
        fileSystem: expect.any(TestService),
      },
      {},
      {
        key: expect.any(String),
      },
    );

    expect(dispatchedCommands).toContainEqual({
      type: 'success',
      command,
      from: 'testSource',
    });

    () => {
      // type checks
      dispatchService.dispatch(
        'command::ui:toggle-sidebar',
        // @ts-expect-error arg should be null, since no arg is specified in the command
        {},
        'testSource',
      );
    };

    expect(mockLog.debug).toHaveBeenCalledWith(
      '[command-dispatch]',
      'Dispatching command::ui:toggle-sidebar from testSource:',
      null,
    );
  });

  test('should dispatch a command with args successfully', async () => {
    const { mockLog, commandRegistry, dispatchService } = await setup();
    const command = {
      id: 'command::ui:test-no-use',
      keywords: ['new', 'create', 'workspace'],
      dependencies: { services: ['fileSystem'] },
      omniSearch: true,
      args: {
        workspaceType: T.String,
      },
    } as const satisfies Command;

    const handler = vi.fn();

    commandRegistry.register(command);
    commandRegistry.registerHandler({
      id: 'command::ui:test-no-use',
      handler,
    });

    dispatchService.dispatch(
      'command::ui:test-no-use',
      {
        workspaceType: 'browser',
        wsName: 'test-ws',
      },
      'testSource',
    );

    expect(handler).toHaveBeenCalledWith(
      {
        fileSystem: expect.any(TestService),
      },
      {
        workspaceType: 'browser',
        wsName: 'test-ws',
      },
      {
        key: expect.any(String),
      },
    );

    expect(mockLog.debug).toBeCalledWith(
      '[command-dispatch]',
      'Dispatching command::ui:test-no-use from testSource:',
      {
        workspaceType: 'browser',
        wsName: 'test-ws',
      },
    );

    () => {
      // type checks
      dispatchService.dispatch(
        'command::ui:test-no-use',
        // @ts-expect-error missing required arg
        null,
        'testSource',
      );

      dispatchService.dispatch(
        'command::ui:test-no-use',
        // @ts-expect-error empty arg
        {},
        'testSource',
      );

      dispatchService.dispatch(
        'command::ui:test-no-use',
        // @ts-expect-error incorrect arg type
        { workspaceType: 3 },
        'testSource',
      );

      dispatchService.dispatch(
        'command::ui:test-no-use',
        {
          workspaceType: 'test-ws',
          // @ts-expect-error extra arg that is not specified in the command
          extra: 'extra',
        },
        'testSource',
      );
    };
  });

  test('should throw error when dispatching a non-existent command', async () => {
    const { dispatchService } = await setup();
    expect(() =>
      // @ts-expect-error non-existent command
      dispatchService.dispatch('nonExistentCommand', null, 'testSource'),
    ).toThrow(/Command "nonExistentCommand" not found/);
  });

  test('should warn when handler for command is not found', async () => {
    const { mockLog, commandRegistry, dispatchService } = await setup();
    const command = {
      id: 'command::ui:toggle-sidebar',
      keywords: ['test', 'command'],
      dependencies: { services: ['fileSystem'] },
      omniSearch: true,
      args: null,
    } as const satisfies Command;

    commandRegistry.register(command);
    dispatchService.dispatch(command.id, null, 'testSource');

    expect(mockLog.warn).toHaveBeenCalledWith(
      '[command-dispatch]',
      'Handler for command "command::ui:toggle-sidebar" not found.',
    );
  });

  test('should not include services not specified in command.services', async () => {
    const { commandRegistry, dispatchService } = await setup();
    const command = {
      id: 'command::ui:toggle-sidebar',
      keywords: ['test', 'command'],
      dependencies: { services: [] },
      omniSearch: true,
      args: null,
    } as const satisfies Command;
    const handler = vi.fn();

    commandRegistry.register(command);
    commandRegistry.registerHandler({
      id: 'command::ui:toggle-sidebar',
      handler,
    });

    dispatchService.dispatch('command::ui:toggle-sidebar', null, 'testSource');

    // handler should be called with an empty object
    expect(handler).toHaveBeenCalledWith(
      {},
      {},
      {
        key: expect.any(String),
      },
    );
  });

  test('should throw error when dispatch service is not ready', async () => {
    const { dispatchService, controller } = await setup();
    controller.abort();

    expect(() =>
      dispatchService.dispatch(
        'command::ui:toggle-sidebar',
        null,
        'testSource',
      ),
    ).toThrow(/Dispatch service is not ready/);
  });

  test('should throw error for services that donot exist', async () => {
    const { commandRegistry, dispatchService } = await setup();
    const command: Command = {
      id: 'command::ui:toggle-sidebar',
      keywords: ['test', 'command'],
      dependencies: { services: ['unknown-service'] as any[] },
      omniSearch: true,
      args: null,
    } as const satisfies Command;
    const handler = vi.fn();

    commandRegistry.register(command);
    commandRegistry.registerHandler({
      id: 'command::ui:toggle-sidebar',
      handler,
    });

    expect(() =>
      dispatchService.dispatch(
        'command::ui:toggle-sidebar',
        null,
        'testSource',
      ),
    ).toThrow(
      /When dispatching command::ui:toggle-sidebar service:"unknown-service" not found./,
    );
  });

  test('should throw error for services for banned service', async () => {
    const { commandRegistry, dispatchService } = await setup();
    const command: Command = {
      id: 'command::ui:toggle-sidebar',
      keywords: ['test', 'command'],
      dependencies: { services: ['commandRegistry'] as any[] },
      omniSearch: true,
      args: null,
    } as const satisfies Command;
    const handler = vi.fn();

    commandRegistry.register(command);
    commandRegistry.registerHandler({
      id: 'command::ui:toggle-sidebar',
      handler,
    });

    expect(() =>
      dispatchService.dispatch(
        'command::ui:toggle-sidebar',
        null,
        'testSource',
      ),
    ).toThrow(
      /Command "command::ui:toggle-sidebar" uses an excluded service "commandRegistry"./,
    );
  });

  test('should allow a command to dispatch another command using the', async () => {
    const { commandRegistry, dispatchService } = await setup();

    const parentCommand = {
      id: 'command::parent',
      dependencies: {
        commands: ['command::child'],
      },
      args: null,
    } as const satisfies Command;

    const childCommand = {
      id: 'command::child',
      dependencies: {},
      args: null,
    } as const satisfies Command;

    const childHandler = vi.fn<CommandHandler>();
    const parentHandler = vi.fn<CommandHandler>((_services, _args, key) => {
      const { dispatch } = getCtx(key);
      dispatch('command::child', null);
    });

    commandRegistry.register(parentCommand);
    commandRegistry.registerHandler({
      id: 'command::parent',
      handler: parentHandler,
    });

    commandRegistry.register(childCommand);
    commandRegistry.registerHandler({
      id: 'command::child',
      handler: childHandler,
    });

    dispatchService.dispatch(
      // @ts-expect-error custom command
      'command::parent',
      null,
      'testSource',
    );

    expect(parentHandler).toHaveBeenCalled();
    expect(childHandler).toHaveBeenCalled();
  });

  test('should prevent cyclic command dispatch using getCtx', async () => {
    const { commandRegistry, dispatchService } = await setup();

    const command = {
      id: 'command::cyclic',
      dependencies: {
        commands: ['command::cyclic'],
      },
      args: null,
    } as const satisfies Command;

    const handler = vi.fn<CommandHandler>((_services, _args, key) => {
      const { dispatch } = getCtx(key);
      dispatch('command::cyclic', null);
    });

    commandRegistry.register(command);
    commandRegistry.registerHandler({
      id: 'command::cyclic',
      handler,
    });

    expect(() => {
      dispatchService.dispatch(
        // @ts-expect-error custom command
        'command::cyclic',
        null,
        'testSource',
      );
    }).toThrowError(`Command "command::cyclic" is trying to dispatch itself.`);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('should detect cyclic dependency in a deeper dispatch chain', async () => {
    const { commandRegistry, dispatchService } = await setup();

    const commandA = {
      id: 'command::A',
      dependencies: {
        commands: ['command::B'],
      },
      args: null,
    } as const satisfies Command;

    const commandB = {
      id: 'command::B',
      dependencies: {
        commands: ['command::C'],
      },
      args: null,
    } as const satisfies Command;

    const commandC = {
      id: 'command::C',
      dependencies: {
        commands: ['command::D'],
      },
      args: null,
    } as const satisfies Command;

    const commandD = {
      id: 'command::D',
      dependencies: {
        commands: ['command::B'],
      },
      args: null,
    } as const satisfies Command;

    const handlerA = vi.fn<CommandHandler>((_services, _args, key) => {
      const { dispatch } = getCtx(key);
      dispatch('command::B', null);
    });

    const handlerB = vi.fn<CommandHandler>((_services, _args, key) => {
      const { dispatch } = getCtx(key);
      dispatch('command::C', null);
    });

    const handlerC = vi.fn<CommandHandler>((_services, _args, key) => {
      const { dispatch } = getCtx(key);
      dispatch('command::D', null);
    });

    const handlerD = vi.fn<CommandHandler>((_services, _args, key) => {
      const { dispatch } = getCtx(key);
      dispatch('command::B', null); // This will cause cyclic dependency
    });

    commandRegistry.register(commandA);
    commandRegistry.registerHandler({
      id: 'command::A',
      handler: handlerA,
    });

    commandRegistry.register(commandB);
    commandRegistry.registerHandler({
      id: 'command::B',
      handler: handlerB,
    });

    commandRegistry.register(commandC);
    commandRegistry.registerHandler({
      id: 'command::C',
      handler: handlerC,
    });

    commandRegistry.register(commandD);
    commandRegistry.registerHandler({
      id: 'command::D',
      handler: handlerD,
    });

    expect(() => {
      dispatchService.dispatch(
        // @ts-expect-error custom command
        'command::A',
        null,
        'testSource',
      );
    }).toThrowError('Command "command::B" dispatch has cyclic dependency.');

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(handlerC).toHaveBeenCalledTimes(1);
    expect(handlerD).toHaveBeenCalledTimes(1);
  });

  // Add test for command failure
  test('should handle command failure correctly', async () => {
    const { commandRegistry, dispatchService, dispatchedCommands } =
      await setup();
    const failingCommand = {
      id: 'command::fail',
      dependencies: { services: ['fileSystem'] },
      args: null,
    } as const satisfies Command;

    const failingHandler = vi.fn().mockImplementation(() => {
      throw new BaseError({ message: 'Command failed' });
    });

    commandRegistry.register(failingCommand);
    commandRegistry.registerHandler({
      id: 'command::fail',
      handler: failingHandler,
    });

    expect(() =>
      dispatchService.dispatch(
        // @ts-expect-error custom command
        'command::fail',
        {},
        'testSource',
      ),
    ).toThrow(/Command failed/);

    expect(dispatchedCommands).toContainEqual({
      type: 'failure',
      command: failingCommand,
      from: 'testSource',
    });
  });

  // Add test for asynchronous command dispatch
  test('should handle async commands correctly', async () => {
    const { commandRegistry, dispatchService, dispatchedCommands } =
      await setup();
    const asyncCommand = {
      id: 'command::async',
      dependencies: { services: ['fileSystem'] },
      args: null,
    } as const satisfies Command;

    const asyncHandler = vi.fn().mockResolvedValue('Async Success');

    commandRegistry.register(asyncCommand);
    commandRegistry.registerHandler({
      id: 'command::async',
      handler: asyncHandler,
    });

    dispatchService.dispatch(
      // @ts-expect-error custom command
      'command::async',
      {},
      'testSource',
    );

    expect(dispatchedCommands).toHaveLength(0);

    // Wait for the async handler to resolve
    await Promise.resolve();

    expect(asyncHandler).toHaveBeenCalledWith(
      {
        fileSystem: expect.any(TestService),
      },
      {},
      {
        key: expect.any(String),
      },
    );

    expect(dispatchedCommands).toContainEqual({
      type: 'success',
      command: asyncCommand,
      from: 'testSource',
    });
  });
});
