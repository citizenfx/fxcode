// see vs/workbench/browser/web.main.ts
import { mark } from 'vs/base/common/performance';
import { domContentLoaded, detectFullscreen, getCookieValue } from 'vs/base/browser/dom';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ILogService, getLogLevel } from 'vs/platform/log/common/log';
import { Disposable } from 'vs/base/common/lifecycle';
import { BrowserWorkbenchEnvironmentService } from 'vs/workbench/services/environment/browser/environmentService';
import { Workbench } from 'vs/workbench/browser/workbench';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IProductService } from 'vs/platform/product/common/productService';
import product from 'vs/platform/product/common/product';
import { RemoteAuthorityResolverService } from 'vs/platform/remote/browser/remoteAuthorityResolverService';
import { IRemoteAuthorityResolverService } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { IFileService } from 'vs/platform/files/common/files';
import { FileService } from 'vs/platform/files/common/fileService';
import { Schemas } from 'vs/base/common/network';
import { IAnyWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IWorkbenchConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { onUnexpectedError } from 'vs/base/common/errors';
import { setFullscreen } from 'vs/base/browser/browser';
import { URI } from 'vs/base/common/uri';
import { WorkspaceService } from 'vs/workbench/services/configuration/browser/configurationService';
import { ISignService } from 'vs/platform/sign/common/sign';
import { SignService } from 'vs/platform/sign/browser/signService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { BufferLogService } from 'vs/platform/log/common/bufferLog';
import { toLocalISOString } from 'vs/base/common/date';
import { getSingleFolderWorkspaceIdentifier, getWorkspaceIdentifier } from 'vs/workbench/services/workspaces/browser/workspaces';
import { InMemoryFileSystemProvider } from 'vs/platform/files/common/inMemoryFilesystemProvider';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { BrowserRequestService } from 'vs/workbench/services/request/browser/requestService';
import { IRequestService } from 'vs/platform/request/common/request';
import { IUserDataInitializationService, UserDataInitializationService } from 'vs/workbench/services/userData/browser/userDataInit';
import { UserDataSyncStoreManagementService } from 'vs/platform/userDataSync/common/userDataSyncStoreService';
import { IUserDataSyncStoreManagementService } from 'vs/platform/userDataSync/common/userDataSync';
import { ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { UriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentityService';
import { BrowserWindow } from 'vs/workbench/browser/window';
import { ITimerService } from 'vs/workbench/services/timer/browser/timerService';
import { WorkspaceTrustEnablementService, WorkspaceTrustManagementService } from 'vs/workbench/services/workspaces/common/workspaceTrust';
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from 'vs/platform/workspace/common/workspaceTrust';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { safeStringify } from 'vs/base/common/objects';
import { RemoteAgentService } from './remoteAgentServiceImpl';
import { ConfigurationCache } from 'vs/workbench/services/configuration/common/configurationCache';
import { DeferredPromise } from 'vs/base/common/async';
import { ITunnel, ITunnelOptions, IWorkbench, IWorkbenchConstructionOptions } from 'vs/workbench/browser/web.api';
import { BrowserStorageService } from 'vs/workbench/services/storage/browser/storageService';
import { RemoteFileSystemProvider } from 'vs/workbench/test/browser/workbenchTestServices';
import { FileUserDataProvider } from 'vs/platform/userData/common/fileUserDataProvider';
import { IWorkspace } from 'vs/workbench/services/host/browser/browserHostService';
import { isFolderToOpen, isWorkspaceToOpen } from 'vs/platform/window/common/window';
import { IUserDataProfileService } from 'vs/workbench/services/userDataProfile/common/userDataProfile';
import { IUserDataProfilesService } from 'vs/platform/userDataProfile/common/userDataProfile';
import { IPolicyService, NullPolicyService } from 'vs/platform/policy/common/policy';
import { TelemetryLevel } from 'vs/platform/telemetry/common/telemetry';
import { staticObservableValue } from 'vs/base/common/observableValue';
import { UserDataProfileService } from 'vs/workbench/services/userDataProfile/common/userDataProfileService';
import { BrowserUserDataProfilesService } from 'vs/platform/userDataProfile/browser/userDataProfile';
import { workspace } from 'vscode';
import { BrowserCredentialsService } from 'vs/workbench/services/credentials/browser/credentialsService';
import { ICredentialsService } from 'vs/platform/credentials/common/credentials';

class BrowserMain extends Disposable {

	constructor(
		private readonly domElement: HTMLElement,
		private readonly configuration: IWorkbenchConstructionOptions
	) {
		super();

		this.init();
	}

	private init(): void {

		// Browser config
		setFullscreen(!!detectFullscreen());
	}

	async open(): Promise<IWorkbench> {

		// Init services and wait for DOM to be ready in parallel
		const [services] = await Promise.all([this.initServices(), domContentLoaded()]);

		// Create Workbench
		const workbench = new Workbench(this.domElement, undefined, services.serviceCollection, services.logService);

		// Listeners
		this.registerListeners(workbench, services.storageService, services.logService);

		// Startup
		const instantiationService = workbench.startup();

		// Window
		this._register(instantiationService.createInstance(BrowserWindow));

		// Logging
		services.logService.trace('workbench configuration', safeStringify(this.configuration));

		// Return API Facade
		return instantiationService.invokeFunction(accessor => {
			const commandService = accessor.get(ICommandService);
			const lifecycleService = accessor.get(ILifecycleService);
			const timerService = accessor.get(ITimerService);
			const openerService = accessor.get(IOpenerService);
			const productService = accessor.get(IProductService);

			return {
				commands: {
					executeCommand: (command, ...args) => commandService.executeCommand(command, ...args)
				},
				logger: {
					log: (level, message) => {
						// TODO: log
					}
				},
				env: {
					getUriScheme: async () => productService.urlProtocol,

					async retrievePerformanceMarks() {
						await timerService.whenReady();

						return timerService.getPerformanceMarks();
					},

					async openUri(uri: URI): Promise<boolean> {
						return openerService.open(uri, {});
					},

					telemetryLevel: staticObservableValue(TelemetryLevel.NONE)
				},
				window: {
					withProgress: (options, task) => {
						throw new Error('Not implemented');
					}
				},
				workspace: {
					openTunnel: (tunnelOptions: ITunnelOptions): Promise<ITunnel> => {
						throw new Error('Not implemented');
					}
				},
				shutdown: () => lifecycleService.shutdown(),
			};
		});
	}

	private registerListeners(workbench: Workbench, storageService: BrowserStorageService, logService: ILogService): void {

		// Workbench Lifecycle
		this._register(workbench.onWillShutdown(() => storageService.close()));
		this._register(workbench.onDidShutdown(() => this.dispose()));
	}

	private async initServices(): Promise<{ serviceCollection: ServiceCollection; configurationService: IWorkbenchConfigurationService; logService: ILogService; storageService: BrowserStorageService }> {
		const serviceCollection = new ServiceCollection();

		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		// NOTE: DO NOT ADD ANY OTHER SERVICE INTO THE COLLECTION HERE.
		// CONTRIBUTE IT VIA WORKBENCH.WEB.MAIN.TS AND registerSingleton().
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

		const payload = this.resolveWorkspaceInitializationPayload();

		// Product
		const productService: IProductService = { _serviceBrand: undefined, ...product, ...this.configuration.productConfiguration };
		serviceCollection.set(IProductService, productService);

		// Environment
		const logsPath = URI.file(toLocalISOString(new Date()).replace(/-|:|\.\d+Z$/g, '')).with({ scheme: 'vscode-log' });
		const environmentService = new BrowserWorkbenchEnvironmentService(payload.id, logsPath, { ...this.configuration }, productService);
		serviceCollection.set(IWorkbenchEnvironmentService, environmentService);

		// Log
		const logService = new BufferLogService(getLogLevel(environmentService));
		serviceCollection.set(ILogService, logService);

		// Remote
		const connectionToken = environmentService.options.connectionToken || getCookieValue('vscode-tkn');
		const remoteAuthorityResolverService = new RemoteAuthorityResolverService(productService, connectionToken, this.configuration.resourceUriProvider);
		serviceCollection.set(IRemoteAuthorityResolverService, remoteAuthorityResolverService);

		// Signing
		const signService = new SignService(connectionToken);
		serviceCollection.set(ISignService, signService);

		// Remote Agent
		const remoteAgentService = this._register(new RemoteAgentService(this.configuration.webSocketFactory, environmentService, productService, remoteAuthorityResolverService, signService, logService));
		serviceCollection.set(IRemoteAgentService, remoteAgentService);

		// Files
		const fileService = this._register(new FileService(logService));
		serviceCollection.set(IFileService, fileService);
		await this.registerFileSystemProviders(environmentService, fileService, remoteAgentService, logService, logsPath);

		// URI Identity
		const uriIdentityService = new UriIdentityService(fileService);
		serviceCollection.set(IUriIdentityService, uriIdentityService);

		// User Data Profiles
		const userDataProfilesService = new BrowserUserDataProfilesService(environmentService, fileService, uriIdentityService, logService);
		serviceCollection.set(IUserDataProfilesService, userDataProfilesService);
		const lastActiveProfile = environmentService.lastActiveProfile ? userDataProfilesService.profiles.find(p => p.id === environmentService.lastActiveProfile) : undefined;
		const currentProfile = userDataProfilesService.getOrSetProfileForWorkspace(isWorkspaceIdentifier(workspace) || isSingleFolderWorkspaceIdentifier(workspace) ? workspace : 'empty-window', lastActiveProfile ?? userDataProfilesService.defaultProfile);
		const userDataProfileService = new UserDataProfileService(currentProfile, userDataProfilesService);
		serviceCollection.set(IUserDataProfileService, userDataProfileService);

		// Long running services (workspace, config, storage)
		const [configurationService, storageService] = await Promise.all([
			this.createWorkspaceService(payload, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService, new NullPolicyService()).then(service => {

				// Workspace
				serviceCollection.set(IWorkspaceContextService, service);

				// Configuration
				serviceCollection.set(IWorkbenchConfigurationService, service);

				return service;
			}),

			this.createStorageService(payload, userDataProfileService, logService).then(service => {

				// Storage
				serviceCollection.set(IStorageService, service);

				return service;
			})
		]);

		// Workspace Trust Service
		const workspaceTrustEnablementService = new WorkspaceTrustEnablementService(configurationService, environmentService);
		serviceCollection.set(IWorkspaceTrustEnablementService, workspaceTrustEnablementService);

		const workspaceTrustManagementService = new WorkspaceTrustManagementService(configurationService, remoteAuthorityResolverService, storageService, uriIdentityService, environmentService, configurationService, workspaceTrustEnablementService);
		serviceCollection.set(IWorkspaceTrustManagementService, workspaceTrustManagementService);

		// Update workspace trust so that configuration is updated accordingly
		configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
		this._register(workspaceTrustManagementService.onDidChangeTrust(() => configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted())));

		// Request Service
		const requestService = new BrowserRequestService(remoteAgentService, configurationService, logService);
		serviceCollection.set(IRequestService, requestService);

		// Userdata Sync Store Management Service
		const userDataSyncStoreManagementService = new UserDataSyncStoreManagementService(productService, configurationService, storageService);
		serviceCollection.set(IUserDataSyncStoreManagementService, userDataSyncStoreManagementService);

		// Credentials Service
		const credentialsService = new BrowserCredentialsService(environmentService, remoteAgentService, productService);
		serviceCollection.set(ICredentialsService, credentialsService);

		// Userdata Initialize Service
		const userDataInitializationService = new UserDataInitializationService(
			environmentService,
			credentialsService,
			userDataSyncStoreManagementService,
			fileService,
			userDataProfilesService,
			storageService,
			productService,
			requestService,
			logService,
			uriIdentityService,
		);
		serviceCollection.set(IUserDataInitializationService, userDataInitializationService);

		if (await userDataInitializationService.requiresInitialization()) {
			mark('code/willInitRequiredUserData');

			// Initialize required resources - settings & global state
			await userDataInitializationService.initializeRequiredResources();

			// Important: Reload only local user configuration after initializing
			// Reloading complete configuraiton blocks workbench until remote configuration is loaded.
			await configurationService.reloadLocalUserConfiguration();

			mark('code/didInitRequiredUserData');
		}

		return { serviceCollection, configurationService, logService, storageService };
	}

	private async registerFileSystemProviders(environmentService: IWorkbenchEnvironmentService, fileService: IFileService, remoteAgentService: IRemoteAgentService, logService: BufferLogService, logsPath: URI): Promise<void> {
		const connection = remoteAgentService.getConnection();
		if (!connection) {
			throw new Error('No connection, achtung!');
		}

		// Remote file system
		//this._register(RemoteFileSystemProvider.register(remoteAgentService, fileService, logService)); TODO: fixme

		// Temporary files
		fileService.registerProvider(Schemas.tmp, new InMemoryFileSystemProvider());

		const wtf = new DeferredPromise<void>();

		// User Data Provider
		fileService.onDidChangeFileSystemProviderRegistrations((event) => {
			if (event.added && event.provider && (event.provider instanceof RemoteFileSystemProvider) && event.scheme === Schemas.vscodeRemote) {
				fileService.registerProvider(
					Schemas.vscodeUserData,
					new FileUserDataProvider(Schemas.vscodeUserData, event.provider, Schemas.vscodeUserData, logService),
				);

				wtf.complete();
			}
		});

		return wtf.p;
	}

	private async createStorageService(payload: IAnyWorkspaceIdentifier, userDataProfileService: IUserDataProfileService, logService: ILogService): Promise<BrowserStorageService> {
		const storageService = new BrowserStorageService(payload, userDataProfileService, logService);

		try {
			await storageService.initialize();

			return storageService;
		} catch (error) {
			onUnexpectedError(error);
			logService.error(error);

			return storageService;
		}
	}

	private async createWorkspaceService(
		payload: IAnyWorkspaceIdentifier,
		environmentService: IWorkbenchEnvironmentService,
		userDataProfileService: IUserDataProfileService,
		userDataProfilesService: IUserDataProfilesService,
		fileService: FileService,
		remoteAgentService: IRemoteAgentService,
		uriIdentityService: IUriIdentityService,
		logService: ILogService,
		policyService: IPolicyService
	): Promise<WorkspaceService> {
		const configurationCache = new ConfigurationCache([Schemas.file, Schemas.vscodeUserData, Schemas.tmp] /* Cache all non native resources */, environmentService, fileService);
		const workspaceService = new WorkspaceService({ remoteAuthority: this.configuration.remoteAuthority, configurationCache }, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService, policyService);

		try {
			await workspaceService.initialize(payload);

			return workspaceService;
		} catch (error) {
			onUnexpectedError(error);
			logService.error(error);

			return workspaceService;
		}
	}

	private resolveWorkspaceInitializationPayload(): IAnyWorkspaceIdentifier {
		let workspace: IWorkspace | undefined = undefined;
		if (this.configuration.workspaceProvider) {
			workspace = this.configuration.workspaceProvider.workspace;
		}

		// Multi-root workspace
		if (workspace && isWorkspaceToOpen(workspace)) {
			return getWorkspaceIdentifier(workspace.workspaceUri);
		}

		// Single-folder workspace
		if (workspace && isFolderToOpen(workspace)) {
			return getSingleFolderWorkspaceIdentifier(workspace.folderUri);
		}

		return { id: 'empty-window' };
	}
}

export function main(domElement: HTMLElement, options: IWorkbenchConstructionOptions): Promise<IWorkbench> {
	const workbench = new BrowserMain(domElement, options);

	return workbench.open();
}