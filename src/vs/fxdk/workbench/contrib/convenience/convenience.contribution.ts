import { getShellApi } from "vs/fxdk/browser/shellApi";
import { Action2, MenuRegistry, registerAction2 } from "vs/platform/actions/common/actions";
import { CommandsRegistry } from "vs/platform/commands/common/commands";
import { ServicesAccessor } from "vs/platform/instantiation/common/instantiation";
import { FxDKMenu, FxDKMenuGroup } from "../../fxdkMenu";

interface ConvenienceEventAction<T = undefined> {
	type: string,
	title: string,
	data?: T | undefined,
}

let index = 1;

registerConvenienceEventAction({
	type: 'fxdk:startServer',
	title: 'Start Server',
});
registerConvenienceEventAction({
	type: 'fxdk:buildProject',
	title: 'Build Project',
});

function registerConvenienceEventAction<T = undefined>({ type, title, data }: ConvenienceEventAction<T>) {
	const commandId = `fxdk.convenience:${type}`;

	registerAction2(class extends Action2 {
		constructor() {
			super({
				id: `action(${commandId})`,
				title: `FxDK: ${title}`,
				f1: true,
			});
		}

		run(_accessor: ServicesAccessor) {
			getShellApi().events.emit(type, data);
		}
	});

	CommandsRegistry.registerCommand(commandId, (_accessor: ServicesAccessor) => {
		getShellApi().events.emit(type, data);
	});

	MenuRegistry.appendMenuItem(FxDKMenu, {
		order: index++,
		group: FxDKMenuGroup.Convenience,
		command: {
			id: commandId,
			title,
		},
	});
}
