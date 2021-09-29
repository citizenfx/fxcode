import { Action2, MenuId, MenuRegistry, registerAction2 } from "vs/platform/actions/common/actions";
import { CommandsRegistry, ICommandService } from "vs/platform/commands/common/commands";
import { ContextKeyExpr } from "vs/platform/contextkey/common/contextkey";
import { SyncDescriptor } from "vs/platform/instantiation/common/descriptors";
import { ServicesAccessor } from "vs/platform/instantiation/common/instantiation";
import { Registry } from "vs/platform/registry/common/platform";
import { ViewPaneContainer } from "vs/workbench/browser/parts/views/viewPaneContainer";
import { IViewContainersRegistry, ViewContainer, Extensions as ViewContainerExtensions, ViewContainerLocation, IViewsRegistry, IViewsService } from "vs/workbench/common/views";
import { FXDK_OPEN_GAME_CONSOLE_COMMAND_ID } from "../../fxdkCommands";
import { FxDKMenu, FxDKMenuGroup } from "../../fxdkMenu";
import { CONSOLE_VIEW_ID } from "./console";
import { IConsoleService } from "./consoleService";
import { ConsoleViewPane } from "./consoleView";

const VIEW_CONTAINER: ViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: CONSOLE_VIEW_ID,
	title: 'Game Console',
	order: 1,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [CONSOLE_VIEW_ID, { mergeViewWithContainerWhenSingleView: true, donotShowContainerTitleWhenMergedWithContainer: true }]),
	storageId: CONSOLE_VIEW_ID,
	hideIfEmpty: true,
}, ViewContainerLocation.Panel, { donotRegisterOpenCommand: true });

Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([{
	id: CONSOLE_VIEW_ID,
	name: 'Game Console',
	canMoveView: true,
	canToggleVisibility: false,
	ctorDescriptor: new SyncDescriptor(ConsoleViewPane),
	openCommandActionDescriptor: {
		id: 'fxdk.action.consoles.toggleConsoles',
		order: 1,
	}
}], VIEW_CONTAINER);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: `fxdk.console.toggleServerConsole`,
			title: 'Toggle Consoles',
			menu: [
				{
					id: MenuId.ViewTitle,
					when: ContextKeyExpr.equals('view', CONSOLE_VIEW_ID),
					group: 'navigation',
					order: 2,
				},
			],
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const consoleService = accessor.get(IConsoleService);

		consoleService.serverConsoleEnabled = !consoleService.serverConsoleEnabled;
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'fxdk.openGameConsole',
			title: 'FxDK: Open Game Console',
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor) {
		accessor.get(ICommandService).executeCommand(FXDK_OPEN_GAME_CONSOLE_COMMAND_ID);
	}
});

CommandsRegistry.registerCommand(FXDK_OPEN_GAME_CONSOLE_COMMAND_ID, (accessor: ServicesAccessor) => {
	const viewService = accessor.get(IViewsService);

	viewService.openView(CONSOLE_VIEW_ID, true);
});

MenuRegistry.appendMenuItem(FxDKMenu, {
	order: 2,
	group: FxDKMenuGroup.Main,
	command: {
		id: FXDK_OPEN_GAME_CONSOLE_COMMAND_ID,
		title: 'Game Console',
	},
});
