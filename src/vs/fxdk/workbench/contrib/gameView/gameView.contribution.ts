import { Action2, MenuRegistry, registerAction2 } from "vs/platform/actions/common/actions";
import { CommandsRegistry, ICommandService } from "vs/platform/commands/common/commands";
import { SyncDescriptor } from "vs/platform/instantiation/common/descriptors";
import { IInstantiationService, ServicesAccessor } from "vs/platform/instantiation/common/instantiation";
import { Registry } from "vs/platform/registry/common/platform";
import { EditorPaneDescriptor, IEditorPaneRegistry } from "vs/workbench/browser/editor";
import { EditorExtensions, IEditorFactoryRegistry } from "vs/workbench/common/editor";
import { IEditorService } from "vs/workbench/services/editor/common/editorService";
import { FXDK_OPEN_GAME_VIEW_COMMAND_ID } from "../../fxdkCommands";
import { FxDKMenu, FxDKMenuGroup } from "../../fxdkMenu";
import { GameViewInputSerializer, GameViewPage } from "./gameView";
import { GameViewInput } from "./gameViewInput";

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(GameViewInput.ID, GameViewInputSerializer);
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		GameViewPage,
		GameViewPage.ID,
		'Game View',
	),
	[
		new SyncDescriptor(GameViewInput),
	]
);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'fxdk.openGameView',
			title: 'FxDK: Open Game View',
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor) {
		accessor.get(ICommandService).executeCommand(FXDK_OPEN_GAME_VIEW_COMMAND_ID);
	}
});

CommandsRegistry.registerCommand(FXDK_OPEN_GAME_VIEW_COMMAND_ID, (accessor: ServicesAccessor) => {
	const editorService = accessor.get(IEditorService);

	editorService.openEditor(accessor.get(IInstantiationService).createInstance(GameViewInput), {
		pinned: true,
		revealIfOpened: true,
	});
});

MenuRegistry.appendMenuItem(FxDKMenu, {
	order: 1,
	group: FxDKMenuGroup.Main,
	command: {
		id: FXDK_OPEN_GAME_VIEW_COMMAND_ID,
		title: 'Game View',
	},
});
