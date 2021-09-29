import 'vs/css!./fxdkMenu';
import { IAction } from "vs/base/common/actions";
import { Codicon } from "vs/base/common/codicons";
import { IMenuService, MenuId } from "vs/platform/actions/common/actions";
import { IConfigurationService } from "vs/platform/configuration/common/configuration";
import { IContextKeyService } from "vs/platform/contextkey/common/contextkey";
import { IContextMenuService } from "vs/platform/contextview/browser/contextView";
import { IKeybindingService } from "vs/platform/keybinding/common/keybinding";
import { IColorTheme, IThemeService } from "vs/platform/theme/common/themeService";
import { MenuActivityActionViewItem } from "vs/workbench/browser/parts/activitybar/activitybarActions";
import { ActivityAction, IActivityHoverOptions, ICompositeBarColors } from "vs/workbench/browser/parts/compositeBarActions";
import { IWorkbenchEnvironmentService } from "vs/workbench/services/environment/common/environmentService";
import { IHoverService } from "vs/workbench/services/hover/browser/hover";

export const FxDKIcon = new Codicon('fxdk', { fontCharacter: '\0' });

export const FxDKMenu = new MenuId('fxdk');

export enum FxDKMenuGroup {
	Main = '1_main',
	Links = '2_links',
	Convenience = '3_convenience',
	Misc = '4_misc',
}

export class FxDKActivityActionViewItem extends MenuActivityActionViewItem {
	constructor(
		action: ActivityAction,
		contextMenuActionsProvider: () => IAction[],
		colors: (theme: IColorTheme) => ICompositeBarColors,
		activityHoverOptions: IActivityHoverOptions,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IMenuService menuService: IMenuService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IConfigurationService configurationService: IConfigurationService,
		@IKeybindingService keybindingService: IKeybindingService,
	) {
		super(FxDKMenu, action, contextMenuActionsProvider, colors, activityHoverOptions, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, environmentService, keybindingService);
	}
}
