import { Registry } from 'vs/platform/registry/common/platform';
import { CATEGORIES } from 'vs/workbench/common/actions';
import { Action2, MenuRegistry, registerAction2 } from 'vs/platform/actions/common/actions';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IFileService, whenProviderRegistered } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { IOutputChannelRegistry, Extensions as OutputExt } from 'vs/workbench/services/output/common/output';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IOutputService } from 'vs/workbench/contrib/output/common/output';
import { timeout } from 'vs/base/common/async';
import { getErrorMessage } from 'vs/base/common/errors';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { FxDKMenu, FxDKMenuGroup } from '../../fxdkMenu';

const CITIZENFX_LOG_OUTPUT_CHANNEL_ID = 'citizenLog';
const CITIZENFX_SHOW_LOG_COMMAND_ID = 'fxdk.showCitizenFXLog';

// see vs\workbench\contrib\logs\common\logs.contribution.ts
class FxDKLogOutputChannels extends Disposable implements IWorkbenchContribution {

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
	) {
		super();

		this.registerFXDKContributions();
	}

	private async registerFXDKContributions() {
		const logsUri = URI.from({
			scheme: 'citizen',
			path: '/logs',
		});

		await whenProviderRegistered(logsUri, this.fileService);

		const logs = await this.fileService.resolve(logsUri, { resolveMetadata: true });
		if (!logs.children) {
			console.warn('No log files', logs);

			return;
		}

		const mostRecentLogFile = logs.children.sort((a, b) => b.ctime - a.ctime)[0];
		if (!mostRecentLogFile) {
			console.warn('Failed to find most recent log file', logs);

			return;
		}

		this.registerLogChannel(CITIZENFX_LOG_OUTPUT_CHANNEL_ID, 'CitizenFX', mostRecentLogFile.resource);

		registerAction2(class ShowCitizenFXLogAction extends Action2 {
			constructor() {
				super({
					id: `action(${CITIZENFX_SHOW_LOG_COMMAND_ID})`,
					title: 'Show CitizenFX Log',
					category: CATEGORIES.Developer,
					f1: true
				});
			}
			async run(servicesAccessor: ServicesAccessor): Promise<void> {
				servicesAccessor.get(IOutputService).showChannel(CITIZENFX_LOG_OUTPUT_CHANNEL_ID);
			}
		});

		CommandsRegistry.registerCommand(CITIZENFX_SHOW_LOG_COMMAND_ID, (accessor: ServicesAccessor) => {
			accessor.get(IOutputService).showChannel(CITIZENFX_LOG_OUTPUT_CHANNEL_ID);
		});

		MenuRegistry.appendMenuItem(FxDKMenu, {
			order: 9999,
			group: FxDKMenuGroup.Misc,
			command: {
				id: CITIZENFX_SHOW_LOG_COMMAND_ID,
				title: 'CitizenFX Log',
			},
		});
	}

	private async registerLogChannel(id: string, label: string, file: URI): Promise<void> {
		await whenProviderRegistered(file, this.fileService);
		const outputChannelRegistry = Registry.as<IOutputChannelRegistry>(OutputExt.OutputChannels);
		try {
			await this.whenFileExists(file);
			outputChannelRegistry.registerChannel({ id, label, file, log: true });
		} catch (error) {
			this.logService.error('Error while registering log channel', file.toString(), getErrorMessage(error));
		}
	}

	private async whenFileExists(file: URI, trial = 1): Promise<void> {
		const exists = await this.fileService.exists(file);
		if (exists) {
			return;
		}
		if (trial > 10) {
			throw new Error(`Timed out while waiting for file to be created`);
		}
		this.logService.debug(`[Registering Log Channel] File does not exist. Waiting for 1s to retry.`, file.toString());
		await timeout(1000);
		await this.whenFileExists(file, trial + 1);
	}

}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(FxDKLogOutputChannels, LifecyclePhase.Restored);
