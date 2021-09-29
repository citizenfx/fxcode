import product from 'vs/platform/product/common/product';
import { Emitter } from 'vs/base/common/event';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { parseLogLevel } from 'vs/platform/log/common/log';
import { defaultWebSocketFactory } from 'vs/platform/remote/browser/browserSocketFactory';
import { RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { create, ICredentialsProvider, IWorkspace } from 'vs/workbench/workbench.web.api';
import { FxDKWorkspaceProvider } from 'vs/fxdk/browser/workspace/workspaceProvider';
import { initialColorTheme } from 'vs/fxdk/workbench/browser/initialColorTheme';

interface ICredential {
	service: string;
	account: string;
	password: string;
}

class LocalStorageCredentialsProvider implements ICredentialsProvider {

	static readonly CREDENTIALS_OPENED_KEY = 'credentials.provider';

	private _credentials: ICredential[] | undefined;
	private get credentials(): ICredential[] {
		if (!this._credentials) {
			try {
				const serializedCredentials = window.localStorage.getItem(LocalStorageCredentialsProvider.CREDENTIALS_OPENED_KEY);
				if (serializedCredentials) {
					this._credentials = JSON.parse(serializedCredentials);
				}
			} catch (error) {
				// ignore
			}

			if (!Array.isArray(this._credentials)) {
				this._credentials = [];
			}
		}

		return this._credentials;
	}

	private save(): void {
		window.localStorage.setItem(LocalStorageCredentialsProvider.CREDENTIALS_OPENED_KEY, JSON.stringify(this.credentials));
	}

	async getPassword(service: string, account: string): Promise<string | null> {
		for (const credential of this.credentials) {
			if (credential.service === service) {
				if (typeof account !== 'string' || account === credential.account) {
					return credential.password;
				}
			}
		}

		return null;
	}

	async setPassword(service: string, account: string, password: string): Promise<void> {
		this.deletePassword(service, account);

		this.credentials.push({ service, account, password });

		this.save();
	}

	async deletePassword(service: string, account: string): Promise<boolean> {
		let found = false;

		this._credentials = this.credentials.filter(credential => {
			if (credential.service === service && credential.account === account) {
				found = true;

				return false;
			}

			return true;
		});

		if (found) {
			this.save();
		}

		return found;
	}

	async findPassword(_service: string): Promise<string | null> {
		return null;
	}

	async findCredentials(_service: string): Promise<Array<{ account: string, password: string }>> {
		return [];
	}

}

export async function doStart(): Promise<IDisposable> {
	const subscriptions = new DisposableStore();

	const remoteAuthority = window.location.host;

	// Find workspace to open and payload
	let payload = Object.create(null);
	let logLevel: string | undefined = undefined;

	const folderPath = (new Map(new URL(document.location.href).searchParams)).get('path');
	const workspace: IWorkspace = {
		folderUri: URI.parse(`vscode-remote://${remoteAuthority}/${encodeURIComponent(folderPath || '')}`),
	};

	// Workspace Provider
	const workspaceProvider = new FxDKWorkspaceProvider(workspace, payload);

	const credentialsProvider = new LocalStorageCredentialsProvider();

	const webviewEndpoint = new URL(window.location.href);
	webviewEndpoint.pathname = '/fxcode-static/out/vs/workbench/contrib/webview/browser/pre/';
	webviewEndpoint.search = '';

	const webWorkerExtensionEndpoint = new URL(window.location.href);
	webWorkerExtensionEndpoint.pathname = `/fxcode-static/out/vs/workbench/services/extensions/worker/${window.location.protocol === 'https:' ? 'https' : 'http'}WebWorkerExtensionHostIframe.html`;
	webWorkerExtensionEndpoint.search = '';

	subscriptions.add(create(document.body, {
		webviewEndpoint: webviewEndpoint.href,
		webWorkerExtensionHostIframeSrc: webWorkerExtensionEndpoint.href,
		// We're trying to pretend we're not in remote very hard
		// remoteAuthority,
		webSocketFactory: {
			create: url => {
				const codeServerUrl = new URL(url);
				codeServerUrl.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
				const socket = defaultWebSocketFactory.create(codeServerUrl.toString());
				const onError = new Emitter<RemoteAuthorityResolverError>();
				socket.onError(e => {
					if (!(e instanceof RemoteAuthorityResolverError)) {
						// by default VS Code does not try to reconnect if the web socket is closed clean:
						// override it as a temporary network error
						e = new RemoteAuthorityResolverError('WebSocket closed', RemoteAuthorityResolverErrorCode.TemporarilyNotAvailable, e);
					}
					onError.fire(e);
				});
				return {
					onData: socket.onData,
					onOpen: socket.onOpen,
					onClose: socket.onClose,
					onError: onError.event,
					send: data => socket.send(data),
					close: () => {
						socket.close();
						onError.dispose();
					}
				};
			}
		},
		workspaceProvider,
		resourceUriProvider: uri => {
			return URI.from({
				scheme: location.protocol === 'https:' ? 'https' : 'http',
				authority: remoteAuthority,
				path: `/vscode-remote-resource`,
				query: `path=${encodeURIComponent(uri.path)}`
			});
		},
		configurationDefaults: {
			'workbench.colorTheme': 'FxDK Dark',
			'workbench.iconTheme': 'ayu',
			'files.autoSave': 'off',
		},
		initialColorTheme,
		developmentOptions: {
			logLevel: logLevel ? parseLogLevel(logLevel) : undefined
		},
		credentialsProvider,
		productConfiguration: {
			version: '1.61.2-cfx',
			"nameShort": "FXCode",
			"nameLong": "FXCode",
			"applicationName": "fxcode",
			"dataFolderName": ".fxcode",
			"extensionsGallery": {
				"serviceUrl": "https://marketplace.visualstudio.com/_apis/public/gallery",
				"itemUrl": "https://marketplace.visualstudio.com/items",
				"resourceUrlTemplate": "https://{publisher}.vscode-unpkg.net/{publisher}/{name}/{version}/{path}",
				"controlUrl": "https://az764295.vo.msecnd.net/extensions/marketplace.json",
				"recommendationsUrl": "https://az764295.vo.msecnd.net/extensions/workspaceRecommendations.json.gz"
			},
			"reportIssueUrl": "https://github.com/citizenfx/fivem/issues/new",
			"licenseUrl": "https://github.com/citizenfx/fxcode/blob/fivem-main/LICENSE.txt",
			linkProtectionTrustedDomains: [
				...(product.linkProtectionTrustedDomains || []),
			],
		},
		settingsSyncOptions: {
			enabled: false,
			enablementHandler: enablement => {
				// TODO
			}
		},
	}));
	return subscriptions;
}

doStart();
