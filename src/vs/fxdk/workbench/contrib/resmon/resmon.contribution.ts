import { Action2, MenuRegistry, registerAction2 } from "vs/platform/actions/common/actions";
import { CommandsRegistry, ICommandService } from "vs/platform/commands/common/commands";
import { SyncDescriptor } from "vs/platform/instantiation/common/descriptors";
import { ServicesAccessor } from "vs/platform/instantiation/common/instantiation";
import { Registry } from "vs/platform/registry/common/platform";
import { ViewPaneContainer } from "vs/workbench/browser/parts/views/viewPaneContainer";
import { IViewContainersRegistry, ViewContainer, Extensions as ViewContainerExtensions, ViewContainerLocation, IViewsRegistry, IViewsService } from "vs/workbench/common/views";
import { FXDK_OPEN_GAME_CONSOLE_COMMAND_ID, FXDK_OPEN_RESMON_COMMAND_ID } from "../../fxdkCommands";
import { FxDKMenu, FxDKMenuGroup } from "../../fxdkMenu";
import { RESMON_VIEW_ID } from "./resmon";
import { ResmonViewPane } from "./resmonView";

const VIEW_CONTAINER: ViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: RESMON_VIEW_ID,
	title: 'Resource Monitor',
	order: 1,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [RESMON_VIEW_ID, { mergeViewWithContainerWhenSingleView: true, donotShowContainerTitleWhenMergedWithContainer: true }]),
	storageId: RESMON_VIEW_ID,
	hideIfEmpty: true,
}, ViewContainerLocation.Panel, { donotRegisterOpenCommand: true });

Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([{
	id: RESMON_VIEW_ID,
	name: 'Resource Monitor',
	canMoveView: true,
	canToggleVisibility: false,
	ctorDescriptor: new SyncDescriptor(ResmonViewPane),
	openCommandActionDescriptor: {
		id: 'suka',
		order: 1,
	}
}], VIEW_CONTAINER);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'fxdk.openResmon',
			title: 'FxDK: Open Resurce Monitor',
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor) {
		accessor.get(ICommandService).executeCommand(FXDK_OPEN_GAME_CONSOLE_COMMAND_ID);
	}
});

CommandsRegistry.registerCommand(FXDK_OPEN_RESMON_COMMAND_ID, (accessor: ServicesAccessor) => {
	const viewService = accessor.get(IViewsService);

	viewService.openView(RESMON_VIEW_ID, true);
});

MenuRegistry.appendMenuItem(FxDKMenu, {
	group: FxDKMenuGroup.Main,
	order: 3,
	command: {
		id: FXDK_OPEN_RESMON_COMMAND_ID,
		title: 'Resource Monitor',
	},
});
