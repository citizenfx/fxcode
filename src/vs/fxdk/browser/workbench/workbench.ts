import product from 'vs/platform/product/common/product';
import { Emitter } from 'vs/base/common/event';
import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { parseLogLevel } from 'vs/platform/log/common/log';
import { defaultWebSocketFactory } from 'vs/platform/remote/browser/browserSocketFactory';
import { RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { extractLocalHostUriMetaDataForPortMapping } from 'vs/platform/remote/common/tunnel';
import { ColorScheme } from 'vs/platform/theme/common/theme';
import { create, ICredentialsProvider, IWorkspace } from 'vs/workbench/workbench.web.api';
import { FxDKWorkspaceProvider } from 'vs/fxdk/browser/workspace/workspaceProvider';

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

let _state: any = 'init';
const onDidChangeEmitter = new Emitter<void>();
const toStop = new DisposableStore();
toStop.add(onDidChangeEmitter);
toStop.add({
	dispose: () => {
		_state = 'terminated';
		onDidChangeEmitter.fire();
	}
});

async function doStart(): Promise<IDisposable> {
	// running from sources
	if (_state === 'terminated') {
		return Disposable.None;
	}

	const subscriptions = new DisposableStore();
	if (_state as any === 'terminated') {
		return Disposable.None;
	}

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
	if (_state as any === 'terminated') {
		return Disposable.None;
	}

	subscriptions.add(create(document.body, {
		remoteAuthority,
		webSocketFactory: {
			create: url => {
				if (_state as any === 'terminated') {
					throw new RemoteAuthorityResolverError('workspace stopped', RemoteAuthorityResolverErrorCode.NotAvailable);
				}
				const codeServerUrl = new URL(url);
				codeServerUrl.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
				const socket = defaultWebSocketFactory.create(codeServerUrl.toString());
				const onError = new Emitter<RemoteAuthorityResolverError>();
				socket.onError(e => {
					if (_state as any === 'terminated') {
						// if workspace stopped then don't try to reconnect, regardless how websocket was closed
						e = new RemoteAuthorityResolverError('workspace stopped', RemoteAuthorityResolverErrorCode.NotAvailable, e);
					}
					// otherwise reconnect always
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
		resolveExternalUri: async (uri) => {
			const localhost = extractLocalHostUriMetaDataForPortMapping(uri);
			if (!localhost) {
				console.log('not localhost!', uri);
				return uri;
			}

			throw new Error('IMPLEMENT resolveExternalUri');
		},
		initialColorTheme: {
			themeType: ColorScheme.LIGHT,
			colors: {
				'statusBarItem.remoteBackground': '#FF8A00',
				'statusBarItem.remoteForeground': '#f9f9f9',
				'statusBar.background': '#F3F3F3',
				'statusBar.foreground': '#292524',
				'statusBar.noFolderBackground': '#FF8A00',
				'statusBar.debuggingBackground': '#FF8A00',
				'sideBar.background': '#fcfcfc',
				'sideBarSectionHeader.background': '#f9f9f9',
				'activityBar.background': '#f9f9f9',
				'activityBar.foreground': '#292524',
				'editor.background': '#ffffff',
				'button.background': '#FF8A00',
				'button.foreground': '#ffffff',
				'list.activeSelectionBackground': '#e7e5e4',
				'list.activeSelectionForeground': '#292524',
				'list.inactiveSelectionForeground': '#292524',
				'list.inactiveSelectionBackground': '#F9F9F9',
				'minimap.background': '#FCFCFC',
				'minimapSlider.activeBackground': '#F9F9F9',
				'tab.inactiveBackground': '#F9F9F9',
				'editor.selectionBackground': '#FFE4BC',
				'editor.inactiveSelectionBackground': '#FFE4BC'
			}
		},
		configurationDefaults: {
			'workbench.colorTheme': 'VSCode Light',
		},
		developmentOptions: {
			logLevel: logLevel ? parseLogLevel(logLevel) : undefined
		},
		credentialsProvider,
		productConfiguration: {
			linkProtectionTrustedDomains: [
				...(product.linkProtectionTrustedDomains || []),
			],
		},
		defaultLayout: {
			views: [{
				id: 'terminal'
			}]
		},
		settingsSyncOptions: {
			enabled: true,
			enablementHandler: enablement => {
				// TODO
			}
		},
	}));
	return subscriptions;
}

doStart();
