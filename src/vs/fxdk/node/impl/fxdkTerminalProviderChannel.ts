import { field, logger } from '../logger';
import * as os from 'os';
import { Emitter, Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as platform from 'vs/base/common/platform';
import * as resources from 'vs/base/common/resources';
import { IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { ILogService } from 'vs/platform/log/common/log';
import product from 'vs/platform/product/common/product';
import { RemoteAgentConnectionContext } from 'vs/platform/remote/common/remoteAgentEnvironment';
import { IShellLaunchConfig, ITerminalEnvironment } from 'vs/platform/terminal/common/terminal';
import { transformIncoming } from 'vs/fxdk/node/util';
import { IEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariable';
import { MergedEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariableCollection';
import { deserializeEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariableShared';
import * as terminal from 'vs/workbench/contrib/terminal/common/remoteTerminalChannel';
import * as terminalEnvironment from 'vs/workbench/contrib/terminal/common/terminalEnvironment';
import { PtyHostService } from 'vs/platform/terminal/node/ptyHostService';
import { FxDKVariableResolverService } from 'vs/fxdk/node/impl/fxdkVariableResolverService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IURITransformer, transformIncomingURIs } from 'vs/base/common/uriIpc';
import { cloneAndChange } from 'vs/base/common/objects';
import { URI } from 'vs/base/common/uri';

export class FxDKTerminalProviderChannel implements IServerChannel<RemoteAgentConnectionContext>, IDisposable {
	private _lastRequestId = 0;
	private _pendingRequests = new Map<number, { resolve: (data: any) => void, reject: (error: any) => void, uriTransformer: IURITransformer }>();

	private readonly _onExecuteCommand = new Emitter<{ reqId: number, commandId: string, commandArgs: any[] }>();
	readonly onExecuteCommand = this._onExecuteCommand.event;

	public constructor(
		private readonly logService: ILogService,
		private readonly ptyService: PtyHostService,
	) { }

	public listen(_: RemoteAgentConnectionContext, event: string, args: any): Event<any> {
		if (event === '$onExecuteCommand') {
			return this._onExecuteCommand.event;
		}

		const serviceRecord = this.ptyService as unknown as Record<string, Event<any>>;
		const result = serviceRecord[event.substring(1, event.endsWith('Event') ? event.length - 'Event'.length : undefined)];
		if (!result) {
			this.logService.error('Unknown event: ' + event);
			return Event.None;
		}
		return result;
	}

	public async call(context: RemoteAgentConnectionContext, command: string, args: any, cancellationToken?: CancellationToken | undefined): Promise<any> {
		logger.trace('TerminalProviderChannel:call', field('command', command), field('args', args));

		if (command === '$createProcess') {
			return this.createProcess(context.remoteAuthority, args);
		}

		if (command === '$sendCommandResult') {
			return this.sendCommandResult(args[0], args[1], args[2]);
		}

		// Generic method handling for all other commands
		const serviceRecord = this.ptyService as unknown as Record<string, (arg?: any) => Promise<any>>;
		const serviceFunc = serviceRecord[command.substring(1)];
		if (!serviceFunc) {
			this.logService.error('Unknown command: ' + command);
			return;
		}

		if (Array.isArray(args)) {
			return serviceFunc.call(this.ptyService, ...args);
		} else {
			return serviceFunc.call(this.ptyService, args);
		}
	}

	public async dispose(): Promise<void> {
		// Nothing at the moment.
	}

	// References: - ../../workbench/api/node/extHostTerminalService.ts
	//             - ../../workbench/contrib/terminal/browser/terminalProcessManager.ts
	private async createProcess(remoteAuthority: string, args: terminal.ICreateTerminalProcessArguments): Promise<terminal.ICreateTerminalProcessResult> {
		const shellLaunchConfig: IShellLaunchConfig = {
			name: args.shellLaunchConfig.name,
			executable: args.shellLaunchConfig.executable,
			args: args.shellLaunchConfig.args,
			// TODO: Should we transform if it's a string as well? The incoming
			// transform only takes `UriComponents` so I suspect it's not necessary.
			cwd: typeof args.shellLaunchConfig.cwd !== 'string'
				? transformIncoming(remoteAuthority, args.shellLaunchConfig.cwd)
				: args.shellLaunchConfig.cwd,
			env: args.shellLaunchConfig.env,
		};

		const activeWorkspaceUri = transformIncoming(remoteAuthority, args.activeWorkspaceFolder?.uri);
		const activeWorkspace = activeWorkspaceUri && args.activeWorkspaceFolder ? {
			...args.activeWorkspaceFolder,
			uri: activeWorkspaceUri,
			toResource: (relativePath: string) => resources.joinPath(activeWorkspaceUri, relativePath),
		} : undefined;

		const resolverService = new FxDKVariableResolverService(remoteAuthority, args, process.env);
		const resolver = terminalEnvironment.createVariableResolver(activeWorkspace, process.env, resolverService);

		shellLaunchConfig.cwd = terminalEnvironment.getCwd(
			shellLaunchConfig,
			os.homedir(),
			resolver,
			activeWorkspaceUri,
			args.configuration['terminal.integrated.cwd'],
			this.logService,
		);

		// Use instead of `terminal.integrated.env.${platform}` to make types work.
		const getEnvFromConfig = (): ITerminalEnvironment => {
			if (platform.isWindows) {
				return args.configuration['terminal.integrated.env.windows'];
			} else if (platform.isMacintosh) {
				return args.configuration['terminal.integrated.env.osx'];
			}
			return args.configuration['terminal.integrated.env.linux'];
		};

		// ptyHostService calls getEnvironment in the ptyHost process it creates,
		// which uses that process's environment. The process spawned doesn't have
		// VSCODE_IPC_HOOK_CLI in its env, so we add it here.
		const getEnvironment = async (): Promise<platform.IProcessEnvironment> => {
			const env = await this.ptyService.getEnvironment();
			env.VSCODE_IPC_HOOK_CLI = process.env['VSCODE_IPC_HOOK_CLI']!;
			return env;
		};

		const env = terminalEnvironment.createTerminalEnvironment(
			shellLaunchConfig,
			getEnvFromConfig(),
			resolver,
			product.version,
			args.configuration['terminal.integrated.detectLocale'],
			await getEnvironment()
		);

		// Apply extension environment variable collections to the environment.
		if (!shellLaunchConfig.strictEnv) {
			// They come in an array and in serialized format.
			const envVariableCollections = new Map<string, IEnvironmentVariableCollection>();
			for (const [k, v] of args.envVariableCollections) {
				envVariableCollections.set(k, { map: deserializeEnvironmentVariableCollection(v) });
			}
			const mergedCollection = new MergedEnvironmentVariableCollection(envVariableCollections);
			mergedCollection.applyToProcessEnvironment(env);
		}

		const persistentTerminalId = await this.ptyService.createProcess(
			shellLaunchConfig,
			shellLaunchConfig.cwd,
			args.cols,
			args.rows,
			args.unicodeVersion,
			env,
			process.env as platform.IProcessEnvironment, // Environment used for findExecutable
			false, // windowsEnableConpty
			args.shouldPersistTerminal,
			args.workspaceId,
			args.workspaceName,
		);

		return {
			persistentTerminalId,
			resolvedShellLaunchConfig: shellLaunchConfig,
		};
	}

	executeCommand(uriTransformer: IURITransformer, id: string, args: any[]): Promise<any> {
		let resolve: (data: any) => void, reject: (error: any) => void;
		const promise = new Promise<any>((c, e) => { resolve = c; reject = e; });

		const reqId = ++this._lastRequestId;
		this._pendingRequests.set(reqId, { resolve: resolve!, reject: reject!, uriTransformer });

		const commandArgs = cloneAndChange(args, value => {
			if (value instanceof URI) {
				return uriTransformer.transformOutgoingURI(value);
			}
			return;
		});
		this._onExecuteCommand.fire({ reqId, commandId: id, commandArgs });

		return promise;
	}

	private async sendCommandResult(reqId: number, isError: boolean, payload: any): Promise<any> {
		const reqData = this._pendingRequests.get(reqId);
		if (!reqData) {
			return;
		}

		this._pendingRequests.delete(reqId);

		const result = transformIncomingURIs(payload, reqData.uriTransformer);
		if (isError) {
			reqData.reject(result);
		} else {
			reqData.resolve(result);
		}
	}
}
