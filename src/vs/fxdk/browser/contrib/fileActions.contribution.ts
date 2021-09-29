import * as nls from 'vs/nls';
import { ToggleAutoSaveAction } from 'vs/workbench/contrib/files/browser/fileActions';
import { revertLocalChangesCommand, acceptLocalChangesCommand, CONFLICT_RESOLUTION_CONTEXT } from 'vs/workbench/contrib/files/browser/editors/textFileSaveErrorHandler';
import { MenuId, MenuRegistry, ILocalizedString } from 'vs/platform/actions/common/actions';
import { OPEN_TO_SIDE_COMMAND_ID, SAVE_FILE_COMMAND_ID, SAVE_ALL_IN_GROUP_COMMAND_ID, OpenEditorsGroupContext, SAVE_ALL_COMMAND_ID } from 'vs/workbench/contrib/files/browser/fileCommands';
import { CommandsRegistry, ICommandHandler } from 'vs/platform/commands/common/commands';
import { ContextKeyExpr, ContextKeyExpression } from 'vs/platform/contextkey/common/contextkey';
import { ExplorerFolderContext, ExplorerViewletVisibleContext } from 'vs/workbench/contrib/files/common/files';
import { CLOSE_SAVED_EDITORS_COMMAND_ID, CLOSE_EDITORS_IN_GROUP_COMMAND_ID, CLOSE_EDITOR_COMMAND_ID, CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID } from 'vs/workbench/browser/parts/editor/editorCommands';
import { ResourceContextKey } from 'vs/workbench/common/resources';
import { Schemas } from 'vs/base/common/network';
import { DirtyWorkingCopiesContext } from 'vs/workbench/browser/contextkeys';
import { ActiveEditorContext } from 'vs/workbench/common/editor';
import { SidebarFocusContext } from 'vs/workbench/common/viewlet';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';
import { Codicon } from 'vs/base/common/codicons';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IFilesConfigurationService } from 'vs/workbench/services/filesConfiguration/common/filesConfigurationService';

export function appendEditorTitleContextMenuItem(id: string, title: string, when: ContextKeyExpression | undefined, group?: string): void {

	// Menu
	MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
		command: { id, title },
		when,
		group: group || '2_files'
	});
}

// Editor Title Menu for Conflict Resolution
appendSaveConflictEditorTitleAction('workbench.files.action.acceptLocalChanges', nls.localize('acceptLocalChanges', "Use your changes and overwrite file contents"), Codicon.check, -10, acceptLocalChangesCommand);
appendSaveConflictEditorTitleAction('workbench.files.action.revertLocalChanges', nls.localize('revertLocalChanges', "Discard your changes and revert to file contents"), Codicon.discard, -9, revertLocalChangesCommand);

function appendSaveConflictEditorTitleAction(id: string, title: string, icon: ThemeIcon, order: number, command: ICommandHandler): void {

	// Command
	CommandsRegistry.registerCommand(id, command);

	// Action
	MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
		command: { id, title, icon },
		when: ContextKeyExpr.equals(CONFLICT_RESOLUTION_CONTEXT, true),
		group: 'navigation',
		order
	});
}

// Menu registration - command palette

export function appendToCommandPalette(id: string, title: ILocalizedString, category: ILocalizedString, when?: ContextKeyExpression): void {
	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id,
			title,
			category
		},
		when
	});
}

// Menu registration - open editors

const isFileOrUntitledResourceContextKey = ContextKeyExpr.or(ResourceContextKey.IsFileSystemResource, ResourceContextKey.Scheme.isEqualTo(Schemas.untitled));

const openToSideCommand = {
	id: OPEN_TO_SIDE_COMMAND_ID,
	title: nls.localize('openToSide', "Open to the Side")
};
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
	group: 'navigation',
	order: 10,
	command: openToSideCommand,
	when: isFileOrUntitledResourceContextKey
});

MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
	group: '2_save',
	order: 30,
	command: {
		id: SAVE_ALL_IN_GROUP_COMMAND_ID,
		title: nls.localize('saveAll', "Save All"),
		precondition: DirtyWorkingCopiesContext
	},
	// Editor Group
	when: OpenEditorsGroupContext
});

MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
	group: '4_close',
	order: 10,
	command: {
		id: CLOSE_EDITOR_COMMAND_ID,
		title: nls.localize('close', "Close")
	},
	when: OpenEditorsGroupContext.toNegated()
});

MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
	group: '4_close',
	order: 20,
	command: {
		id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID,
		title: nls.localize('closeOthers', "Close Others")
	},
	when: OpenEditorsGroupContext.toNegated()
});

MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
	group: '4_close',
	order: 30,
	command: {
		id: CLOSE_SAVED_EDITORS_COMMAND_ID,
		title: nls.localize('closeSaved', "Close Saved")
	}
});

MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
	group: '4_close',
	order: 40,
	command: {
		id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
		title: nls.localize('closeAll', "Close All")
	}
});

// Menu registration - explorer

MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
	group: 'navigation',
	order: 10,
	command: openToSideCommand,
	when: ContextKeyExpr.and(ExplorerFolderContext.toNegated(), ResourceContextKey.HasResource)
});

// File menu

MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	group: '4_save',
	command: {
		id: SAVE_FILE_COMMAND_ID,
		title: nls.localize({ key: 'miSave', comment: ['&& denotes a mnemonic'] }, "&&Save"),
		precondition: ContextKeyExpr.or(ActiveEditorContext, ContextKeyExpr.and(ExplorerViewletVisibleContext, SidebarFocusContext))
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	group: '4_save',
	command: {
		id: SAVE_ALL_COMMAND_ID,
		title: nls.localize({ key: 'miSaveAll', comment: ['&& denotes a mnemonic'] }, "Save A&&ll"),
		precondition: DirtyWorkingCopiesContext
	},
	order: 3
});


CommandsRegistry.registerCommand(ToggleAutoSaveAction.ID, (accessor: ServicesAccessor) => {
	accessor.get(IFilesConfigurationService).toggleAutoSave();
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	group: '5_autosave',
	command: {
		id: ToggleAutoSaveAction.ID,
		title: nls.localize({ key: 'miAutoSave', comment: ['&& denotes a mnemonic'] }, "A&&uto Save"),
		toggled: ContextKeyExpr.notEquals('config.files.autoSave', 'off')
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	group: '6_close',
	command: {
		id: CLOSE_EDITOR_COMMAND_ID,
		title: nls.localize({ key: 'miCloseEditor', comment: ['&& denotes a mnemonic'] }, "&&Close Editor"),
		precondition: ContextKeyExpr.or(ActiveEditorContext, ContextKeyExpr.and(ExplorerViewletVisibleContext, SidebarFocusContext))
	},
	order: 2
});

// Go to menu

MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
	group: '3_global_nav',
	command: {
		id: 'workbench.action.quickOpen',
		title: nls.localize({ key: 'miGotoFile', comment: ['&& denotes a mnemonic'] }, "Go to &&File...")
	},
	order: 1
});
