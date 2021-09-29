import { Vscode } from 'vs/fxdk/node/vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import * as url from 'url';
import { URI } from 'vs/base/common/uri';
import { ILogService } from 'vs/platform/log/common/log';

const devMode = true;

const APP_ROOT = path.join(__dirname, '../../../..');
const WEB_MAIN = path.join(APP_ROOT, 'out', 'vs', 'fxdk', 'browser', 'workbench', 'workbench.html');
const WEB_MAIN_DEV = path.join(APP_ROOT, 'out', 'vs', 'fxdk', 'browser', 'workbench', 'workbench-dev.html');

// TODO is it enough?
const textMimeType = new Map([
	['.html', 'text/html'],
	['.js', 'text/javascript'],
	['.json', 'application/json'],
	['.css', 'text/css'],
	['.svg', 'image/svg+xml']
]);

// TODO is it enough?
const mapExtToMediaMimes = new Map([
	['.bmp', 'image/bmp'],
	['.gif', 'image/gif'],
	['.ico', 'image/x-icon'],
	['.jpe', 'image/jpg'],
	['.jpeg', 'image/jpg'],
	['.jpg', 'image/jpg'],
	['.png', 'image/png'],
	['.tga', 'image/x-tga'],
	['.tif', 'image/tiff'],
	['.tiff', 'image/tiff'],
	['.woff', 'application/font-woff']
]);

function getMediaMime(forPath: string): string | undefined {
	const ext = path.extname(forPath);
	return mapExtToMediaMimes.get(ext.toLowerCase());
}

async function serveFile(logService: ILogService, req: http.IncomingMessage, res: http.ServerResponse, filePath: string, responseHeaders: http.OutgoingHttpHeaders = {}) {
	try {

		// Sanity checks
		filePath = path.normalize(filePath); // ensure no "." and ".."

		const stat = await fs.promises.stat(filePath);

		// Check if file modified since
		const etag = `W/"${[stat.ino, stat.size, stat.mtime.getTime()].join('-')}"`; // weak validator (https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
		if (req.headers['if-none-match'] === etag) {
			res.writeHead(304);
			return res.end();
		}

		// Headers
		responseHeaders['Content-Type'] = textMimeType.get(path.extname(filePath)) || getMediaMime(filePath) || 'text/plain';
		responseHeaders['Etag'] = etag;

		res.writeHead(200, responseHeaders);

		// Data
		fs.createReadStream(filePath).pipe(res);
	} catch (error) {
		logService.error(error.toString());
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		return res.end('Not found');
	}
}

function serveError(req: http.IncomingMessage, res: http.ServerResponse, errorCode: number, errorMessage: string): void {
	res.writeHead(errorCode, { 'Content-Type': 'text/plain' });
	res.end(errorMessage);
}

export async function startServer() {
	const port = 8080;

	const vscode = new Vscode();

	await vscode.initialize({
		args: {
			_: [],
		},
		startPath: {
			url: 'C:/dev/test',
			workspace: false,
		},
		remoteAuthority: 'http://127.0.0.1:8080',
	});

	const logService = vscode.getLogService();

	const server = http.createServer(async (req, res) => {
		if (!req.url) {
			return serveError(req, res, 400, 'Bad Request.');
		}
		try {
			const parsedUrl = url.parse(req.url, true);
			const pathname = parsedUrl.pathname;

			//#region headless
			if (pathname === '/vscode-remote-resource') {
				const filePath = parsedUrl.query['path'];
				const fsPath = typeof filePath === 'string' && URI.from({ scheme: 'file', path: filePath }).fsPath;
				if (!fsPath) {
					return serveError(req, res, 400, 'Bad Request.');
				}
				return serveFile(logService, req, res, fsPath);
			}
			//#region headless end

			//#region static
			if (pathname === '/') {
				return serveFile(logService, req, res, devMode ? WEB_MAIN_DEV : WEB_MAIN);
			}
			if (pathname === '/manifest.json') {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				return res.end(JSON.stringify({
					'name': 'FxDK long',
					'short_name': 'FxDK short',
					'start_url': '/',
					'lang': 'en-US',
					'display': 'standalone'
				}));
			}
			if (pathname) {
				let relativeFilePath;
				if (/^\/static\//.test(pathname)) {
					relativeFilePath = path.normalize(decodeURIComponent(pathname.substr('/static/'.length)));
				} else {
					relativeFilePath = path.normalize(decodeURIComponent(pathname));
				}
				return serveFile(logService, req, res, path.join(APP_ROOT, relativeFilePath));
			}
			//#region static end

			// TODO uri callbacks ?
			logService.error(`${req.method} ${req.url} not found`);
			return serveError(req, res, 404, 'Not found.');
		} catch (error) {
			logService.error(error);

			return serveError(req, res, 500, 'Internal Server Error.');
		}
	});
	server.on('error', e => logService.error(e));
	server.on('upgrade', async (req: http.IncomingMessage, socket: net.Socket) => {
		if (req.headers['upgrade'] !== 'websocket' || !req.url) {
			logService.error(`failed to upgrade for header "${req.headers['upgrade']}" and url: "${req.url}".`);
			socket.end('HTTP/1.1 400 Bad Request');
			return;
		}
		const { query } = url.parse(req.url, true);
		// /?reconnectionToken=c0e3a8af-6838-44fb-851b-675401030831&reconnection=false&skipWebSocketFrames=false
		let token: string | undefined;
		if ('reconnectionToken' in query && typeof query['reconnectionToken'] === 'string') {
			token = query['reconnectionToken'];
		}
		// TODO skipWebSocketFrames (support of VS Code desktop?)
		if (!token) {
			logService.error(`missing token for "${req.url}".`);
			socket.end('HTTP/1.1 400 Bad Request');
			return;
		}
		logService.info(`[${token}] Socket upgraded for "${req.url}".`);
		socket.on('error', e => {
			logService.error(`[${token}] Socket failed for "${req.url}".`, e);
		});

		const acceptKey = req.headers['sec-websocket-key'];
		const hash = crypto.createHash('sha1').update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
		const responseHeaders = ['HTTP/1.1 101 Web Socket Protocol Handshake', 'Upgrade: WebSocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${hash}`];

		let permessageDeflate = false;
		if (String(req.headers['sec-websocket-extensions']).indexOf('permessage-deflate') !== -1) {
			permessageDeflate = true;
			responseHeaders.push('Sec-WebSocket-Extensions: permessage-deflate; server_max_window_bits=15');
		}

		socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

		await vscode.handleWebSocket(socket, query, permessageDeflate);
	});

	server.listen(port, '127.0.0.1', () => {
		const { address, port } = server.address() as net.AddressInfo;
		logService.info(`Web UI available at           http://${address}:${port}`);
	});
}

console.log('HELLO FROM FXCODE SERVER');

startServer();
