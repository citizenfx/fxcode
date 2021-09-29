import { URI } from "vs/base/common/uri";
import { Registry } from "vs/platform/registry/common/platform";
import { IEditorService } from "vs/workbench/services/editor/common/editorService";
import { ILifecycleService, LifecyclePhase } from "vs/workbench/services/lifecycle/common/lifecycle";
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { IFxDKDataService } from "../../services/fxdkData/fxdkDataService";
import { CommandsRegistry, ICommandService } from "vs/platform/commands/common/commands";
import { FXDK_OPEN_GAME_VIEW_COMMAND_ID } from "../../fxdkCommands";
import { FileOperation, FileOperationEvent, IFileService } from "vs/platform/files/common/files";
import { FileService } from "vs/platform/files/common/fileService";
import { IOpenerService } from "vs/platform/opener/common/opener";
import { IExtensionGalleryService, IExtensionManagementService } from "vs/platform/extensionManagement/common/extensionManagement";
import { CancellationToken } from "vs/base/common/cancellation";
import { IExtensionService } from "vs/workbench/services/extensions/common/extensions";
import { Schemas } from "vs/base/common/network";
import { Emitter } from "vs/base/common/event";
import { getShellApi } from "vs/fxdk/browser/shellApi";
import { IFxDKGlue, IWindowWithFxDKGlue } from "vs/fxdk/browser/glue";
import { ServicesAccessor } from "vs/platform/instantiation/common/instantiation";
import { MenuId, MenuRegistry } from "vs/platform/actions/common/actions";
import { ResourceContextKey } from "vs/workbench/common/resources";
import { getResourceForCommand } from "vs/workbench/contrib/files/browser/files";
import { IListService } from "vs/platform/list/browser/listService";
import { IWorkspaceContextService } from "vs/platform/workspace/common/workspace";
import { FindInFilesActionId } from "vs/workbench/contrib/search/common/constants";
import { TerminalCommandId } from "vs/workbench/contrib/terminal/common/terminal";

export class FxDKGlue implements IFxDKGlue {
	private readonly _onDidReadyChange = new Emitter<boolean>();
	public onDidReadyChange = this._onDidReadyChange.event;

	constructor(
		@IFxDKDataService public readonly dataService: IFxDKDataService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IFileService private readonly fileService: FileService,
		@ICommandService private readonly commandService: ICommandService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IEditorService private readonly editorService: IEditorService,
		@IExtensionService private readonly extensionsService: IExtensionService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IExtensionGalleryService private readonly extensionGalleryService: IExtensionGalleryService,
	) {
		(<IWindowWithFxDKGlue>window).fxdkGlue = this;

		this.fileService.registerProvider('citizen', this.fileService.getProvider(Schemas.vscodeRemote)!);

		this.when(LifecyclePhase.Starting).then(() => {
			this.openerService.setDefaultExternalOpener({
				async openExternal(href: string): Promise<boolean> {
					invokeNative('openUrl', href);

					return true;
				},
			})
		});

		this.when(LifecyclePhase.Ready).then(() => {
			const pageLoader = document.getElementById('fxdk-page-loader')!;
			pageLoader.style.opacity = '0';
			pageLoader.style.pointerEvents = 'none';

			getShellApi().events.emit('fxcode:ready');

			this.installLangExtensions();
		});

		window.addEventListener('unload', () => {
			getShellApi().events.emit('fxcode:notReady');
		});
	}

	public async openProjectFile(filepath: string, pinned: boolean) {
		await this.when(LifecyclePhase.Ready);

		this.editorService.openEditor({
			resource: this.shellFileToResource(filepath),
			options: {
				pinned,
			},
		});
	}

	public emitFileDeleted(filepath: string) {
		this.fileService.fireFileOperationEvent(new FileOperationEvent(
			this.shellFileToResource(filepath),
			FileOperation.DELETE,
		));
	}

	public async emitFileMoved(from: string, to: string) {
		this.fileService.fireFileOperationEvent(new FileOperationEvent(
			this.shellFileToResource(from),
			FileOperation.MOVE,
			await this.fileService.resolve(this.shellFileToResource(to), { resolveMetadata: true }),
		));
	}

	public async findInFiles(entryPath: string) {
		await this.when(LifecyclePhase.Ready);
		this.commandService.executeCommand(FindInFilesActionId, { query: '', filesToInclude: entryPath });
	}

	public async revealInTerminal(entryPath: string) {
		await this.when(LifecyclePhase.Ready);
		this.commandService.executeCommand(TerminalCommandId.New, { cwd: entryPath });
	}

	public installExtensions(ids: string[]) {
		return this.doInstallExtensions(ids, false);
	}

	public openGameView() {
		this.commandService.executeCommand(FXDK_OPEN_GAME_VIEW_COMMAND_ID);
	}

	private async when(phase: LifecyclePhase) {
		await this.lifecycleService.when(phase);
	}

	private shellFileToResource(filepath: string): URI {
		return URI.from({
			scheme: Schemas.vscodeRemote,
			authority: window.location.host,
			path: '/' + filepath.replace(/\\/g, '/'),
		});
	}

	private async installLangExtensions() {
		return this.doInstallExtensions(['ms-dotnettools.csharp', 'sumneko.lua'], true);
	}

	private async doInstallExtensions(ids: string[], isBuiltin: boolean) {
		if (ids.length === 0) {
			return;
		}

		const idsToInstall = (await Promise.all(
			ids.map((id) => this.extensionsService.getExtension(id).then((extension) => extension ? '' : id)),
		)).filter(Boolean);

		return this.installExtensionsFromGallery(idsToInstall, isBuiltin);
	}

	private async installExtensionsFromGallery(ids: string[], isBuiltin = true) {
		if (ids.length === 0) {
			return;
		}

		const extensions = await this.extensionGalleryService.getExtensions(ids.map((id) => ({ id })), CancellationToken.None);

		await Promise.all(extensions.map((extension) => {
			return this.extensionManagementService.installFromGallery(extension, { isBuiltin });
		}));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(FxDKGlue, LifecyclePhase.Starting);

const REVEAL_IN_SHELL_COMMAND_ID = 'fxdk.revealInShell';

CommandsRegistry.registerCommand(REVEAL_IN_SHELL_COMMAND_ID, (accessor: ServicesAccessor, resource: URI | object) => {
	const uri = getResourceForCommand(resource, accessor.get(IListService), accessor.get(IEditorService));
	if (uri && accessor.get(IWorkspaceContextService).isInsideWorkspace(uri)) {
		getShellApi().events.emit('fxdk:revealFile', uri.fsPath);
	}
});

MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
	command: {
		id: REVEAL_IN_SHELL_COMMAND_ID,
		title: 'Reveal in Project Explorer',
	},
	when: ResourceContextKey.IsFileSystemResource,
	group: '2_files',
});
