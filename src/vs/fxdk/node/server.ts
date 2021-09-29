import { Vscode } from 'vs/fxdk/node/vscode';
import * as crypto from 'crypto';
import * as net from 'net';
import * as path from 'path';
import { URI } from 'vs/base/common/uri';
import { DeferredPromise } from 'vs/base/common/async';

const devMode = process.env.FXCODE_DEV_MODE === 'true';

const APP_ROOT = path.join(__dirname, '../../../..');
const WEB_MAIN = path.join(APP_ROOT, 'out', 'vs', 'fxdk', 'browser', 'workbench', 'workbench.html');
const WEB_MAIN_DEV = path.join(APP_ROOT, 'out', 'vs', 'fxdk', 'browser', 'workbench', 'workbench-dev.html');

export class FXCode {
	private vscode = new Vscode();

	private initialization = new DeferredPromise<void>();

	constructor() {
		this.initialize();
	}

	private async initialize() {
		await this.vscode.initialize({
			args: {
				_: [],
				'disable-extension': [
					'vscode.vscode-api-tests',
				],
			},
		});

		this.initialization.complete();
	}

	public getRootPath(): string {
		return APP_ROOT;
	}

	public getRootPagePath(): string {
		return devMode ? WEB_MAIN_DEV : WEB_MAIN;
	}

	public getRemoteResourcePath(query: Record<string, string>): string {
		const queryPath = query.path;
		if (!queryPath) {
			return '';
		}

		return URI.from({ scheme: 'file', path: queryPath }).fsPath;
	}

	public async handleWebSocket(socket: net.Socket, query: Record<string, string>, headers: Record<string, string>) {
		await this.initialization.p;

		const {
			upgrade,
			'sec-websocket-key': acceptKey,
			'sec-websocket-extensions': secWebsocketExtensions,
		} = headers;

		const {
			reconnectionToken: token,
		} = query;

		if (upgrade !== 'websocket') {
			console.error(`[FXCode] failed to upgrade for header "${upgrade}"`);
			socket.end('HTTP/1.1 400 Bad Request');
			return;
		}

		// /?reconnectionToken=c0e3a8af-6838-44fb-851b-675401030831&reconnection=false&skipWebSocketFrames=false
		// TODO skipWebSocketFrames (support of VS Code desktop?)
		if (!token) {
			console.error(`[FXCode] missing token`);
			socket.end('HTTP/1.1 400 Bad Request');
			return;
		}

		socket.on('error', e => {
			console.error(`[FXCode] (${token}) socket failed`, e);
		});

		const hash = crypto.createHash('sha1').update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
		const responseHeaders = ['HTTP/1.1 101 Web Socket Protocol Handshake', 'Upgrade: WebSocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${hash}`];

		let permessageDeflate = false;
		if (String(secWebsocketExtensions).indexOf('permessage-deflate') !== -1) {
			permessageDeflate = true;
			responseHeaders.push('Sec-WebSocket-Extensions: permessage-deflate; server_max_window_bits=15');
		}

		socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

		await this.vscode.handleWebSocket(socket, query, permessageDeflate);
	}
};
