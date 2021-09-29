import * as platform from 'vs/base/common/platform';
import { URI } from 'vs/base/common/uri';
import { transformIncoming } from 'vs/fxdk/node/util';
import * as terminal from 'vs/workbench/contrib/terminal/common/remoteTerminalChannel';
import { AbstractVariableResolverService } from 'vs/workbench/services/configurationResolver/common/variableResolver';

// Reference: - ../../workbench/api/common/extHostDebugService.ts
export class FxDKVariableResolverService extends AbstractVariableResolverService {
	constructor(
		remoteAuthority: string,
		args: terminal.ICreateTerminalProcessArguments,
		env: platform.IProcessEnvironment,
	) {
		super({
			getFolderUri: (name: string): URI | undefined => {
				const folder = args.workspaceFolders.find((f) => f.name === name);
				return folder && URI.revive(folder.uri);
			},
			getWorkspaceFolderCount: (): number => {
				return args.workspaceFolders.length;
			},
			// In ../../workbench/contrib/terminal/common/remoteTerminalChannel.ts it
			// looks like there are `config:` entries which must be for this? Not sure
			// how/if the URI comes into play though.
			getConfigurationValue: (_: URI, section: string): string | undefined => {
				return args.resolvedVariables[`config:${section}`];
			},
			getAppRoot: (): string | undefined => {
				return (args.resolverEnv && args.resolverEnv['VSCODE_CWD']) || env['VSCODE_CWD'] || process.cwd();
			},
			getExecPath: (): string | undefined => {
				// Assuming that resolverEnv is just for use in the resolver and not for
				// the terminal itself.
				return (args.resolverEnv && args.resolverEnv['VSCODE_EXEC_PATH']) || env['VSCODE_EXEC_PATH'];
			},
			// This is just a guess; this is the only file-related thing we're sent
			// and none of these resolver methods seem to get called so I don't know
			// how to test.
			getFilePath: (): string | undefined => {
				const resource = transformIncoming(remoteAuthority, args.activeFileResource);
				if (!resource) {
					return undefined;
				}
				// See ../../editor/standalone/browser/simpleServices.ts;
				// `BaseConfigurationResolverService` calls `getUriLabel` from there.
				if (resource.scheme === 'file') {
					return resource.fsPath;
				}
				return resource.path;
			},
			// It looks like these are set here although they aren't on the types:
			// ../../workbench/contrib/terminal/common/remoteTerminalChannel.ts
			getSelectedText: (): string | undefined => {
				return args.resolvedVariables.selectedText;
			},
			getLineNumber: (): string | undefined => {
				return args.resolvedVariables.selectedText;
			},
		}, undefined, Promise.resolve(env));
	}
}
