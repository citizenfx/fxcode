import { Action2, MenuRegistry, registerAction2 } from "vs/platform/actions/common/actions";
import { CommandsRegistry, ICommandService } from "vs/platform/commands/common/commands";
import { ServicesAccessor } from "vs/platform/instantiation/common/instantiation";
import { FXDK_OPEN_URL } from "../../fxdkCommands";
import { FxDKMenu, FxDKMenuGroup } from "../../fxdkMenu";

let linkIndex = 1;

CommandsRegistry.registerCommand(FXDK_OPEN_URL, (accessor: ServicesAccessor, url: string) => {
	invokeNative('openUrl', url);
});

registerLink('https://docs.fivem.net/docs/', 'Documentation');
registerLink('https://docs.fivem.net/natives/', 'Game Natives');
registerLink('https://forum.cfx.re/c/fxdk/72', 'Forums');

function registerLink(url: string, title: string) {
	const commandId = `fxdk.openLink:${url}`;

	CommandsRegistry.registerCommand(commandId, () => invokeNative('openUrl', url));

	registerAction2(class extends Action2 {
		constructor() {
			super({
				id: `action(${commandId})`,
				title: `FxDK: ${title}`,
				f1: true,
			});
		}

		run(accessor: ServicesAccessor) {
			accessor.get(ICommandService).executeCommand(commandId);
		}
	});

	MenuRegistry.appendMenuItem(FxDKMenu, {
		group: FxDKMenuGroup.Links,
		order: linkIndex++,
		command: {
			id: commandId,
			title,
		},
	});
}