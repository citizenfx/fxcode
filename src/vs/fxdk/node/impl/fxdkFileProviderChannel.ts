import * as path from 'path';
import { VSBuffer } from 'vs/base/common/buffer';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { Emitter, Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ReadableStreamEventPayload } from 'vs/base/common/stream';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { FileDeleteOptions, FileOpenOptions, FileOverwriteOptions, FileReadStreamOptions, FileType, FileWriteOptions, IStat, IWatchOptions } from 'vs/platform/files/common/files';
import { DiskFileSystemProvider } from 'vs/platform/files/node/diskFileSystemProvider';
import { ILogService } from 'vs/platform/log/common/log';
import { RemoteAgentConnectionContext } from 'vs/platform/remote/common/remoteAgentEnvironment';
import { getUriTransformer } from 'vs/fxdk/node/util';
import { IFileChangeDto } from 'vs/workbench/api/common/extHost.protocol';
import { IFxDKEnvironmentService } from 'vs/fxdk/node/impl/fxdkEnvironmentService';
import { Schemas } from 'vs/base/common/network';

/**
 * Extend the file provider to allow unwatching.
 */
class Watcher extends DiskFileSystemProvider {
	public readonly watches = new Map<number, IDisposable>();

	public override dispose(): void {
		this.watches.forEach((w) => w.dispose());
		this.watches.clear();
		super.dispose();
	}

	public _watch(req: number, resource: URI, opts: IWatchOptions): void {
		this.watches.set(req, this.watch(resource, opts));
	}

	public unwatch(req: number): void {
		this.watches.get(req)!.dispose();
		this.watches.delete(req);
	}
}

export class FxDKFileProviderChannel implements IServerChannel<RemoteAgentConnectionContext>, IDisposable {
	private readonly provider: DiskFileSystemProvider;
	private readonly watchers = new Map<string, Watcher>();

	public constructor(
		private readonly environmentService: IFxDKEnvironmentService,
		private readonly logService: ILogService,
	) {
		this.provider = new DiskFileSystemProvider(this.logService);
	}

	public listen(context: RemoteAgentConnectionContext, event: string, args?: any): Event<any> {
		switch (event) {
			case 'filechange': return this.filechange(context, args[0]);
			case 'readFileStream': return this.readFileStream(args[0], args[1]);
		}

		throw new Error(`Invalid listen '${event}'`);
	}

	private filechange(context: RemoteAgentConnectionContext, session: string): Event<IFileChangeDto[]> {
		const emitter = new Emitter<IFileChangeDto[]>({
			onFirstListenerAdd: () => {
				const provider = new Watcher(this.logService);
				this.watchers.set(session, provider);
				const transformer = getUriTransformer(context.remoteAuthority);
				provider.onDidChangeFile((events) => {
					emitter.fire(events.map((event) => ({
						...event,
						resource: transformer.transformOutgoing(event.resource),
					})));
				});
				provider.onDidErrorOccur((event) => this.logService.error(event));
			},
			onLastListenerRemove: () => {
				this.watchers.get(session)!.dispose();
				this.watchers.delete(session);
			},
		});

		return emitter.event;
	}

	private readFileStream(resource: UriComponents, opts: FileReadStreamOptions): Event<ReadableStreamEventPayload<VSBuffer>> {
		const cts = new CancellationTokenSource();
		const fileStream = this.provider.readFileStream(this.transform(resource), opts, cts.token);
		const emitter = new Emitter<ReadableStreamEventPayload<VSBuffer>>({
			onLastListenerRemove: () => cts.cancel(),
		});

		fileStream.on('data', (data) => emitter.fire(VSBuffer.wrap(data)));
		fileStream.on('error', (error) => emitter.fire(error));
		fileStream.on('end', () => {
			emitter.fire('end');
			emitter.dispose();
			cts.dispose();
		});

		return emitter.event;
	}

	public async call(_ctx: RemoteAgentConnectionContext, command: string, args?: any): Promise<any> {
		try {
			switch (command) {
				case 'stat': return await this.stat(args[0]);
				case 'open': return await this.open(args[0], args[1]);
				case 'close': return await this.close(args[0]);
				case 'read': return await this.read(args[0], args[1], args[2]);
				case 'readFile': return await this.readFile(args[0]);
				case 'write': return await this.write(args[0], args[1], args[2], args[3], args[4]);
				case 'writeFile': return await this.writeFile(args[0], args[1], args[2]);
				case 'delete': return await this.delete(args[0], args[1]);
				case 'mkdir': return await this.mkdir(args[0]);
				case 'readdir': return await this.readdir(args[0]);
				case 'rename': return await this.rename(args[0], args[1], args[2]);
				case 'copy': return await this.copy(args[0], args[1], args[2]);
				case 'watch': return await this.watch(args[0], args[1], args[2], args[3]);
				case 'unwatch': return await this.unwatch(args[0], args[1]);
			}
		} catch (e) {
			if (e.message) {
				const notOurBoy = ['.vscode\\launch.json', '.vscode\\settings.json', '.vscode\\tasks.json'].find((testPath) => {
					return e.message.includes(testPath);
				});

				if (notOurBoy) {
					return;
				}
			}

			throw e;
		}

		throw new Error(`Invalid call '${command}': ${JSON.stringify(args)}`);
	}

	public dispose(): void {
		this.watchers.forEach((w) => w.dispose());
		this.watchers.clear();
	}

	private async stat(resource: UriComponents): Promise<IStat> {
		return this.provider.stat(this.transform(resource));
	}

	private async open(resource: UriComponents, opts: FileOpenOptions): Promise<number> {
		return this.provider.open(this.transform(resource), opts);
	}

	private async close(fd: number): Promise<void> {
		return this.provider.close(fd);
	}

	private async read(fd: number, pos: number, length: number): Promise<[number, VSBuffer]> {
		const buffer = VSBuffer.alloc(length);
		const bytesRead = await this.provider.read(fd, pos, buffer.buffer, 0, length);
		return [bytesRead, buffer];
	}

	private async readFile(resource: UriComponents): Promise<VSBuffer> {
		return VSBuffer.wrap(await this.provider.readFile(this.transform(resource)));
	}

	private write(fd: number, pos: number, buffer: VSBuffer, offset: number, length: number): Promise<number> {
		return this.provider.write(fd, pos, buffer.buffer, offset, length);
	}

	private writeFile(resource: UriComponents, buffer: VSBuffer, opts: FileWriteOptions): Promise<void> {
		return this.provider.writeFile(this.transform(resource), buffer.buffer, opts);
	}

	private async delete(resource: UriComponents, opts: FileDeleteOptions): Promise<void> {
		return this.provider.delete(this.transform(resource), opts);
	}

	private async mkdir(resource: UriComponents): Promise<void> {
		return this.provider.mkdir(this.transform(resource));
	}

	private async readdir(resource: UriComponents): Promise<[string, FileType][]> {
		return this.provider.readdir(this.transform(resource));
	}

	private async rename(resource: UriComponents, target: UriComponents, opts: FileOverwriteOptions): Promise<void> {
		return this.provider.rename(this.transform(resource), URI.from(target), opts);
	}

	private copy(resource: UriComponents, target: UriComponents, opts: FileOverwriteOptions): Promise<void> {
		return this.provider.copy(this.transform(resource), URI.from(target), opts);
	}

	private async watch(session: string, req: number, resource: UriComponents, opts: IWatchOptions): Promise<void> {
		this.watchers.get(session)!._watch(req, this.transform(resource), opts);
	}

	private async unwatch(session: string, req: number): Promise<void> {
		this.watchers.get(session)!.unwatch(req);
	}

	private transform(resource: UriComponents): URI {
		// Used for walkthrough content.
		if (/^\/static[^/]*\//.test(resource.path)) {
			return URI.file(this.environmentService.appRoot + resource.path.replace(/^\/static[^/]*\//, '/'));
			// Used by the webview service worker to load resources.
		} else if (resource.path === '/vscode-resource' && resource.query) {
			try {
				const query = JSON.parse(resource.query);
				if (query.requestResourcePath) {
					return URI.file(query.requestResourcePath);
				}
			} catch (error) { /* Carry on. */ }
		} else if (resource.scheme === 'citizen') {
			return URI.file(path.join(process.env.CITIZEN_PATH || '', '..', resource.path.substring(1)));
		} else if (resource.scheme === Schemas.userData) {
			return URI.file(path.join(process.env.LOCALAPPDATA || '', 'citizenfx/sdk-personality-fxcode/user', resource.path.substring(1)));
		}
		return URI.from(resource);
	}
}
