import { Event } from 'vs/base/common/event';
import { transformIncomingURIs, transformOutgoingURIs } from 'vs/base/common/uriIpc';
import { IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { IDiagnosticInfo } from 'vs/platform/diagnostics/common/diagnostics';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { ITelemetryData, ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { getUriTransformer } from 'vs/fxdk/node/util';
import { IScanSingleExtensionArguments } from 'vs/workbench/services/remote/common/remoteAgentEnvironmentChannel';

// See ../../../workbench/services/remote/common/remoteAgentEnvironmentChannel.ts
export class FxDKExtensionEnvironmentChannel implements IServerChannel {
	public constructor(
		private readonly telemetry: ITelemetryService,
	) { }

	public listen(_: unknown, event: string): Event<any> {
		throw new Error(`Invalid listen '${event}'`);
	}

	public async call(context: any, command: string, args: any): Promise<any> {
		const uriTranformer = getUriTransformer(context.remoteAuthority);

		switch (command) {
			/*
			case 'getEnvironmentData':
				return transformOutgoingURIs(
					await this.getEnvironmentData(),
					uriTranformer,
				);
			*/
			case 'scanExtensions':
				return transformOutgoingURIs(
					await this.scanExtensions(args.language),
					uriTranformer,
				);
			case 'scanSingleExtension':
				return transformOutgoingURIs(
					await this.scanSingleExtension(transformIncomingURIs(args, uriTranformer)),
					uriTranformer,
				);
			case 'getDiagnosticInfo': return this.getDiagnosticInfo();
			case 'disableTelemetry': return this.disableTelemetry();
			case 'logTelemetry': return this.logTelemetry(args.eventName, args.data);
			case 'flushTelemetry': return this.flushTelemetry();
		}
		throw new Error(`Invalid call '${command}'`);
	}

	/*
	private async getEnvironmentData(): Promise<IRemoteAgentEnvironment> {
		return {
			pid: process.pid,
			connectionToken: this.connectionToken,
			appRoot: URI.file(this.environment.appRoot),
			settingsPath: this.environment.settingsResource,
			logsPath: URI.file(this.environment.logsPath),
			extensionsPath: URI.file(this.environment.extensionsPath!),
			extensionHostLogsPath: URI.file(path.join(this.environment.logsPath, 'extension-host')),
			globalStorageHome: this.environment.globalStorageHome,
			workspaceStorageHome: this.environment.workspaceStorageHome,
			userHome: this.environment.userHome,
			localHistoryHome: this.environment.localHistoryHome,
			useHostProxy: false,
			os: platform.OS,
			arch: process.arch,
			marks: []
		};
	}
	*/

	private async scanSingleExtension(args: IScanSingleExtensionArguments) {
		/*
		const input = await this.getExtensionsScannerInput(
			args.language,
			args.isBuiltin,
			true,
			URI.revive(args.extensionLocation).fsPath,
		);

		return ExtensionScanner.scanSingleExtension(input, this.log);
		*/
	}

	/*
	private async getExtensionsScannerInput(language: string, isBuiltin: boolean, isUnderDevelopment: boolean, path: string): Promise<void> {
		const translations = await getTranslations(language, this.environment.userDataPath);

		return new ExtensionScannerInput(
			product.version,
			product.date,
			product.commit,
			language,
			!!process.env.VSCODE_DEV,
			path,
			isBuiltin,
			isUnderDevelopment,
			translations,
		);
	}
	*/

	private async scanExtensions(language: string): Promise<IExtensionDescription[]> {
		return []; // TODO: FIXME, ExtensionScanner moved into CachedExtensionScanner
		/*
		const translations = await getTranslations(language, this.environment.userDataPath);

		const scanMultiple = (isBuiltin: boolean, isUnderDevelopment: boolean, paths: string[]): Promise<IExtensionDescription[][]> => {
			return Promise.all(paths.map((path) => {
				return ExtensionScanner.scanExtensions(new ExtensionScannerInput(
					product.version,
					product.date,
					product.commit,
					language,
					!!process.env.VSCODE_DEV,
					path,
					isBuiltin,
					isUnderDevelopment,
					translations,
				), this.log);
			}));
		};

		const scanBuiltin = async (): Promise<IExtensionDescription[][]> => {
			return scanMultiple(true, false, [this.environment.builtinExtensionsPath, ...this.environment.extraBuiltinExtensionPaths]);
		};

		const scanInstalled = async (): Promise<IExtensionDescription[][]> => {
			return scanMultiple(false, true, [this.environment.extensionsPath!, ...this.environment.extraExtensionPaths]);
		};

		return Promise.all([scanBuiltin(), scanInstalled()]).then((allExtensions) => {
			const uniqueExtensions = new Map<string, IExtensionDescription>();
			allExtensions.forEach((multipleExtensions) => {
				multipleExtensions.forEach((extensions) => {
					extensions.forEach((extension) => {
						const id = ExtensionIdentifier.toKey(extension.identifier);
						if (uniqueExtensions.has(id)) {
							const oldPath = uniqueExtensions.get(id)!.extensionLocation.fsPath;
							const newPath = extension.extensionLocation.fsPath;
							this.log.warn(`${oldPath} has been overridden ${newPath}`);
						}
						uniqueExtensions.set(id, extension);
					});
				});
			});
			return Array.from(uniqueExtensions.values());
		});
		*/
	}

	private getDiagnosticInfo(): Promise<IDiagnosticInfo> {
		throw new Error('not implemented');
	}

	private async disableTelemetry(): Promise<void> {
		//this.telemetry.telemetryLevel.value = TelemetryLevel.NONE;
		// this has been removed, FIXME
	}

	private async logTelemetry(eventName: string, data: ITelemetryData): Promise<void> {
		this.telemetry.publicLog(eventName, data);
	}

	private async flushTelemetry(): Promise<void> {
		// We always send immediately at the moment.
	}
}