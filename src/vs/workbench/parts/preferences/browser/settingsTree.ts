/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { Button } from 'vs/base/browser/ui/button/button';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { Color } from 'vs/base/common/color';
import { Emitter, Event } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import * as objects from 'vs/base/common/objects';
import URI from 'vs/base/common/uri';
import { TPromise } from 'vs/base/common/winjs.base';
import { IAccessibilityProvider, IDataSource, IFilter, IRenderer, ITree } from 'vs/base/parts/tree/browser/tree';
import { localize } from 'vs/nls';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { WorkbenchTreeController } from 'vs/platform/list/browser/listService';
import { editorActiveLinkForeground, registerColor } from 'vs/platform/theme/common/colorRegistry';
import { attachButtonStyler, attachInputBoxStyler, attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { ICssStyleCollector, ITheme, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { SettingsTarget } from 'vs/workbench/parts/preferences/browser/preferencesWidgets';
import { ISearchResult, ISetting } from 'vs/workbench/services/preferences/common/preferences';
import { IResolvedTOCEntry } from 'vs/workbench/parts/preferences/browser/settingsEditor2';

const $ = DOM.$;

export const modifiedItemForeground = registerColor('settings.modifiedItemForeground', {
	light: '#019001',
	dark: '#73C991',
	hc: '#73C991'
}, localize('modifiedItemForeground', "(For settings editor preview) The foreground color for a modified setting."));

registerThemingParticipant((theme: ITheme, collector: ICssStyleCollector) => {
	const modifiedItemForegroundColor = theme.getColor(modifiedItemForeground);
	if (modifiedItemForegroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.is-configured .setting-item-is-configured-label { color: ${modifiedItemForegroundColor}; }`);
	}
});

export interface ITreeItem {
	id: string;
}

export enum TreeItemType {
	setting,
	groupTitle
}

export interface ISettingElement extends ITreeItem {
	type: TreeItemType.setting;
	setting: ISetting;

	displayCategory: string;
	displayLabel: string;
	value: any;
	isConfigured: boolean;
	overriddenScopeList: string[];
	description: string;
	valueType?: string | string[];
	enum?: string[];
}

export interface IGroupElement extends ITreeItem {
	type: TreeItemType.groupTitle;
	group: IResolvedTOCEntry;
	index: number;
}

export type TreeElement = ISettingElement | IGroupElement;
export type TreeElementOrRoot = TreeElement | IResolvedTOCEntry | SearchResultModel;

function inspectSetting(key: string, target: SettingsTarget, configurationService: IConfigurationService): { isConfigured: boolean, inspected: any, targetSelector: string } {
	const inspectOverrides = URI.isUri(target) ? { resource: target } : undefined;
	const inspected = configurationService.inspect(key, inspectOverrides);
	const targetSelector = target === ConfigurationTarget.USER ? 'user' :
		target === ConfigurationTarget.WORKSPACE ? 'workspace' :
			'workspaceFolder';
	const isConfigured = typeof inspected[targetSelector] !== 'undefined';

	return { isConfigured, inspected, targetSelector };
}

export class SettingsDataSource implements IDataSource {
	constructor(
		private viewState: ISettingsEditorViewState,
		@IConfigurationService private configurationService: IConfigurationService
	) { }

	getGroupElement(group: IResolvedTOCEntry, index: number): IGroupElement {
		return <IGroupElement>{
			type: TreeItemType.groupTitle,
			group,
			id: sanitizeElementId(group.id),
			index
		};
	}

	getSettingElement(setting: ISetting, group: IResolvedTOCEntry): ISettingElement {
		const { isConfigured, inspected, targetSelector } = inspectSetting(setting.key, this.viewState.settingsTarget, this.configurationService);

		const displayValue = isConfigured ? inspected[targetSelector] : inspected.default;
		const overriddenScopeList = [];
		if (targetSelector === 'user' && typeof inspected.workspace !== 'undefined') {
			overriddenScopeList.push(localize('workspace', "Workspace"));
		}

		if (targetSelector === 'workspace' && typeof inspected.user !== 'undefined') {
			overriddenScopeList.push(localize('user', "User"));
		}

		const displayKeyFormat = settingKeyToDisplayFormat(setting.key, group);
		return <ISettingElement>{
			type: TreeItemType.setting,
			parent: group,
			id: sanitizeElementId(setting.key),
			setting,

			displayLabel: displayKeyFormat.label,
			displayCategory: displayKeyFormat.category,
			isExpanded: false,

			value: displayValue,
			isConfigured,
			overriddenScopeList,
			description: setting.description.join('\n'),
			enum: setting.enum,
			valueType: setting.type
		};
	}

	getId(tree: ITree, element: TreeElementOrRoot): string {
		return element.id;
	}

	hasChildren(tree: ITree, element: TreeElementOrRoot): boolean {
		if (isRoot(element)) {
			return true;
		}

		if (element instanceof SearchResultModel) {
			return true;
		}

		if (element.type === TreeItemType.groupTitle) {
			return true;
		}

		return false;
	}

	_getChildren(element: TreeElementOrRoot): TreeElement[] {
		if (isRoot(element)) {
			return this.getRootChildren(element);
		} else if (element instanceof SearchResultModel) {
			return this.getGroupChildren(element.resultsAsGroup());
		} else if (element.type === TreeItemType.groupTitle) {
			return this.getGroupChildren(element.group);
		} else {
			// No children...
			return null;
		}
	}

	getChildren(tree: ITree, element: TreeElementOrRoot): TPromise<any, any> {
		return TPromise.as(this._getChildren(element));
	}

	private getRootChildren(root: IResolvedTOCEntry): TreeElement[] {
		return root.children
			.map((g, i) => this.getGroupElement(g, i));
	}

	private getGroupChildren(group: IResolvedTOCEntry): TreeElement[] {
		return group.children ?
			group.children.map((child, i) => this.getGroupElement(child, i)) :
			group.settings.map(s => this.getSettingElement(s, group));
	}

	getParent(tree: ITree, element: TreeElement): TPromise<any, any> {
		return TPromise.wrap(null);
	}
}

function sanitizeElementId(id: string): string {
	return id.replace(/\./g, '_');
}

function isRoot(element: TreeElementOrRoot): element is IResolvedTOCEntry {
	return element.id === 'root';
}

export function settingKeyToDisplayFormat(key: string, group: IResolvedTOCEntry): { category: string, label: string } {
	let label = key
		.replace(/\.([a-z])/g, (match, p1) => `.${p1.toUpperCase()}`)
		.replace(/([a-z])([A-Z])/g, '$1 $2') // fooBar => foo Bar
		.replace(/^[a-z]/g, match => match.toUpperCase()); // foo => Foo

	const lastDotIdx = label.lastIndexOf('.');
	let category = '';
	if (lastDotIdx >= 0) {
		category = label.substr(0, lastDotIdx);
		label = label.substr(lastDotIdx + 1);
	}

	category = trimCategoryForGroup(category, group);

	return { category, label };
}

function trimCategoryForGroup(category: string, group: IResolvedTOCEntry): string {
	const doTrim = forward => {
		const parts = group.id.split('.');
		while (parts.length) {
			const reg = new RegExp(`^${parts.join('\\.')}(\\.|$)`, 'i');
			if (reg.test(category)) {
				return category.replace(reg, '');
			}

			if (forward) {
				parts.pop();
			} else {
				parts.shift();
			}
		}

		return null;
	};

	let trimmed = doTrim(true);
	if (trimmed === null) {
		trimmed = doTrim(false);
	}

	if (trimmed === null) {
		trimmed = category;
	}

	return trimmed;
}

export interface ISettingsEditorViewState {
	settingsTarget: SettingsTarget;
	showConfiguredOnly?: boolean;
}

interface IDisposableTemplate {
	toDispose: IDisposable[];
}

interface ISettingItemTemplate extends IDisposableTemplate {
	parent: HTMLElement;

	context?: ISettingElement;
	containerElement: HTMLElement;
	categoryElement: HTMLElement;
	labelElement: HTMLElement;
	descriptionElement: HTMLElement;
	valueElement: HTMLElement;
	isConfiguredElement: HTMLElement;
	otherOverridesElement: HTMLElement;
}

interface IGroupTitleTemplate extends IDisposableTemplate {
	context?: IGroupElement;
	parent: HTMLElement;
	labelElement: HTMLElement;
}

const SETTINGS_ELEMENT_TEMPLATE_ID = 'settings.entry.template';
const SETTINGS_GROUP_ELEMENT_TEMPLATE_ID = 'settings.group.template';

export interface ISettingChangeEvent {
	key: string;
	value: any; // undefined => reset/unconfigure
}

export class SettingsRenderer implements IRenderer {

	private static readonly SETTING_ROW_HEIGHT = 85;

	private readonly _onDidChangeSetting: Emitter<ISettingChangeEvent> = new Emitter<ISettingChangeEvent>();
	public readonly onDidChangeSetting: Event<ISettingChangeEvent> = this._onDidChangeSetting.event;

	private readonly _onDidOpenSettings: Emitter<void> = new Emitter<void>();
	public readonly onDidOpenSettings: Event<void> = this._onDidOpenSettings.event;

	private measureContainer: HTMLElement;

	constructor(
		_measureContainer: HTMLElement,
		@IThemeService private themeService: IThemeService,
		@IContextViewService private contextViewService: IContextViewService
	) {
		this.measureContainer = DOM.append(_measureContainer, $('.setting-measure-container.monaco-tree-row'));
	}

	getHeight(tree: ITree, element: TreeElement): number {
		if (element.type === TreeItemType.groupTitle) {
			return 30;
		}

		if (element.type === TreeItemType.setting) {
			const isSelected = this.elementIsSelected(tree, element);
			if (isSelected) {
				return this.measureSettingElementHeight(tree, element);
			} else {
				return SettingsRenderer.SETTING_ROW_HEIGHT;
			}
		}

		return 0;
	}

	private measureSettingElementHeight(tree: ITree, element: ISettingElement): number {
		const measureHelper = DOM.append(this.measureContainer, $('.setting-measure-helper'));

		const template = this.renderSettingTemplate(tree, measureHelper);
		this.renderSettingElement(tree, element, template);

		const height = measureHelper.offsetHeight;
		this.measureContainer.removeChild(this.measureContainer.firstChild);
		return Math.max(height, SettingsRenderer.SETTING_ROW_HEIGHT);
	}

	getTemplateId(tree: ITree, element: TreeElement): string {
		if (element.type === TreeItemType.groupTitle) {
			return SETTINGS_GROUP_ELEMENT_TEMPLATE_ID;
		}

		if (element.type === TreeItemType.setting) {
			return SETTINGS_ELEMENT_TEMPLATE_ID;
		}

		return '';
	}

	renderTemplate(tree: ITree, templateId: string, container: HTMLElement) {
		if (templateId === SETTINGS_GROUP_ELEMENT_TEMPLATE_ID) {
			return this.renderGroupTitleTemplate(container);
		}

		if (templateId === SETTINGS_ELEMENT_TEMPLATE_ID) {
			return this.renderSettingTemplate(tree, container);
		}

		return null;
	}

	private renderGroupTitleTemplate(container: HTMLElement): IGroupTitleTemplate {
		DOM.addClass(container, 'group-title');

		const labelElement = DOM.append(container, $('h3.settings-group-title-label'));

		const toDispose = [];
		const template: IGroupTitleTemplate = {
			parent: container,
			labelElement,
			toDispose
		};

		return template;
	}

	private renderSettingTemplate(tree: ITree, container: HTMLElement): ISettingItemTemplate {
		DOM.addClass(container, 'setting-item');

		const titleElement = DOM.append(container, $('.setting-item-title'));
		const categoryElement = DOM.append(titleElement, $('span.setting-item-category'));
		const labelElement = DOM.append(titleElement, $('span.setting-item-label'));
		const isConfiguredElement = DOM.append(titleElement, $('span.setting-item-is-configured-label'));
		const otherOverridesElement = DOM.append(titleElement, $('span.setting-item-overrides'));
		const descriptionElement = DOM.append(container, $('.setting-item-description'));

		const valueElement = DOM.append(container, $('.setting-item-value'));

		const toDispose = [];
		const template: ISettingItemTemplate = {
			parent: container,
			toDispose,

			containerElement: container,
			categoryElement,
			labelElement,
			descriptionElement,
			valueElement,
			isConfiguredElement,
			otherOverridesElement
		};

		// Prevent clicks from being handled by list
		toDispose.push(DOM.addDisposableListener(valueElement, 'mousedown', (e: IMouseEvent) => e.stopPropagation()));

		toDispose.push(DOM.addStandardDisposableListener(valueElement, 'keydown', (e: StandardKeyboardEvent) => {
			if (e.keyCode === KeyCode.Escape) {
				tree.domFocus();
				e.browserEvent.stopPropagation();
			}
		}));

		return template;
	}

	renderElement(tree: ITree, element: TreeElement, templateId: string, template: any): void {
		if (templateId === SETTINGS_ELEMENT_TEMPLATE_ID) {
			return this.renderSettingElement(tree, <ISettingElement>element, template);
		}

		if (templateId === SETTINGS_GROUP_ELEMENT_TEMPLATE_ID) {
			(<IGroupTitleTemplate>template).labelElement.textContent = (<IGroupElement>element).group.label;
			return;
		}
	}

	private elementIsSelected(tree: ITree, element: TreeElement): boolean {
		const selection = tree.getSelection();
		const selectedElement: TreeElement = selection && selection[0];
		return selectedElement && selectedElement.id === element.id;
	}

	private renderSettingElement(tree: ITree, element: ISettingElement, template: ISettingItemTemplate): void {
		const isSelected = !!this.elementIsSelected(tree, element);
		const setting = element.setting;

		template.context = element;
		DOM.toggleClass(template.parent, 'is-configured', element.isConfigured);
		DOM.toggleClass(template.parent, 'is-expanded', isSelected);
		template.containerElement.id = element.id;

		const titleTooltip = setting.key;
		template.categoryElement.textContent = element.displayCategory && (element.displayCategory + ': ');
		template.categoryElement.title = titleTooltip;

		template.labelElement.textContent = element.displayLabel;
		template.labelElement.title = titleTooltip;
		template.descriptionElement.textContent = element.description;

		this.renderValue(element, isSelected, template);

		const resetButton = new Button(template.valueElement);
		const resetText = localize('resetButtonTitle', "reset");
		resetButton.label = resetText;
		resetButton.element.title = resetText;
		resetButton.element.classList.add('setting-reset-button');
		resetButton.element.tabIndex = isSelected ? 0 : -1;

		template.toDispose.push(attachButtonStyler(resetButton, this.themeService, {
			buttonBackground: Color.transparent.toString(),
			buttonHoverBackground: Color.transparent.toString(),
			buttonForeground: editorActiveLinkForeground
		}));

		template.toDispose.push(resetButton.onDidClick(e => {
			this._onDidChangeSetting.fire({ key: element.setting.key, value: undefined });
		}));
		template.toDispose.push(resetButton);

		template.isConfiguredElement.textContent = element.isConfigured ? localize('configured', "Modified") : '';

		if (element.overriddenScopeList.length) {
			let otherOverridesLabel = element.isConfigured ?
				localize('alsoConfiguredIn', "Also modified in") :
				localize('configuredIn', "Modified in");

			template.otherOverridesElement.textContent = `(${otherOverridesLabel}: ${element.overriddenScopeList.join(', ')})`;
		}
	}

	private renderValue(element: ISettingElement, isSelected: boolean, template: ISettingItemTemplate): void {
		const onChange = value => this._onDidChangeSetting.fire({ key: element.setting.key, value });
		template.valueElement.innerHTML = '';
		const valueControlElement = DOM.append(template.valueElement, $('.setting-item-control'));
		if (element.enum && (element.valueType === 'string' || !element.valueType)) {
			valueControlElement.classList.add('setting-type-enum');
			this.renderEnum(element, isSelected, template, valueControlElement, onChange);
		} else if (element.valueType === 'boolean') {
			valueControlElement.classList.add('setting-type-boolean');
			this.renderBool(element, isSelected, template, valueControlElement, onChange);
		} else if (element.valueType === 'string') {
			valueControlElement.classList.add('setting-type-string');
			this.renderText(element, isSelected, template, valueControlElement, onChange);
		} else if (element.valueType === 'number' || element.valueType === 'integer') {
			valueControlElement.classList.add('setting-type-number');
			this.renderText(element, isSelected, template, valueControlElement, value => onChange(parseInt(value)));
		} else {
			valueControlElement.classList.add('setting-type-complex');
			this.renderEditInSettingsJson(element, isSelected, template, valueControlElement);
		}
	}

	private renderBool(dataElement: ISettingElement, isSelected: boolean, template: ISettingItemTemplate, element: HTMLElement, onChange: (value: boolean) => void): void {
		const checkboxElement = <HTMLInputElement>DOM.append(element, $('input.setting-value-checkbox.setting-value-input'));
		checkboxElement.type = 'checkbox';
		checkboxElement.checked = dataElement.value;
		checkboxElement.tabIndex = isSelected ? 0 : -1;

		template.toDispose.push(DOM.addDisposableListener(checkboxElement, 'change', e => onChange(checkboxElement.checked)));
	}

	private renderEnum(dataElement: ISettingElement, isSelected: boolean, template: ISettingItemTemplate, element: HTMLElement, onChange: (value: string) => void): void {
		const idx = dataElement.enum.indexOf(dataElement.value);
		const displayOptions = dataElement.enum.map(escapeInvisibleChars);
		const selectBox = new SelectBox(displayOptions, idx, this.contextViewService);
		template.toDispose.push(attachSelectBoxStyler(selectBox, this.themeService));
		selectBox.render(element);
		if (element.firstElementChild) {
			element.firstElementChild.setAttribute('tabindex', isSelected ? '0' : '-1');
		}

		template.toDispose.push(
			selectBox.onDidSelect(e => onChange(dataElement.enum[e.index])));
	}

	private renderText(dataElement: ISettingElement, isSelected: boolean, template: ISettingItemTemplate, element: HTMLElement, onChange: (value: string) => void): void {
		const inputBox = new InputBox(element, this.contextViewService);
		template.toDispose.push(attachInputBoxStyler(inputBox, this.themeService));
		template.toDispose.push(inputBox);
		inputBox.value = dataElement.value;
		inputBox.inputElement.tabIndex = isSelected ? 0 : -1;

		template.toDispose.push(
			inputBox.onDidChange(e => onChange(e)));
	}

	private renderEditInSettingsJson(dataElement: ISettingElement, isSelected: boolean, template: ISettingItemTemplate, element: HTMLElement): void {
		const openSettingsButton = new Button(element, { title: true, buttonBackground: null, buttonHoverBackground: null });
		openSettingsButton.onDidClick(() => this._onDidOpenSettings.fire());
		openSettingsButton.label = localize('editInSettingsJson', "Edit in settings.json");
		openSettingsButton.element.classList.add('edit-in-settings-button');
		openSettingsButton.element.tabIndex = isSelected ? 0 : -1;

		template.toDispose.push(openSettingsButton);
		template.toDispose.push(attachButtonStyler(openSettingsButton, this.themeService, {
			buttonBackground: Color.transparent.toString(),
			buttonHoverBackground: Color.transparent.toString(),
			buttonForeground: 'foreground'
		}));
	}

	disposeTemplate(tree: ITree, templateId: string, template: IDisposableTemplate): void {
		dispose(template.toDispose);
	}
}

function escapeInvisibleChars(enumValue: string): string {
	return enumValue && enumValue
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r');
}

export class SettingsTreeFilter implements IFilter {
	constructor(
		private viewState: ISettingsEditorViewState,
		@IConfigurationService private configurationService: IConfigurationService
	) { }

	isVisible(tree: ITree, element: TreeElement): boolean {
		if (this.viewState.showConfiguredOnly && element.type === TreeItemType.setting) {
			return element.isConfigured;
		}

		if (element.type === TreeItemType.groupTitle && this.viewState.showConfiguredOnly) {
			return this.groupHasConfiguredSetting(element.group);
		}

		return true;
	}

	private groupHasConfiguredSetting(group: IResolvedTOCEntry): boolean {
		if (group.children) {
			return group.children.some(c => this.groupHasConfiguredSetting(c));
		}

		for (let setting of group.settings) {
			const { isConfigured } = inspectSetting(setting.key, this.viewState.settingsTarget, this.configurationService);
			if (isConfigured) {
				return true;
			}
		}

		return false;
	}
}

export class SettingsTreeController extends WorkbenchTreeController {
	constructor(
		@IConfigurationService configurationService: IConfigurationService
	) {
		super({}, configurationService);
	}
}

export class SettingsAccessibilityProvider implements IAccessibilityProvider {
	getAriaLabel(tree: ITree, element: TreeElement): string {
		if (!element) {
			return '';
		}

		if (element.type === TreeItemType.setting) {
			return localize('settingRowAriaLabel', "{0} {1}, Setting", element.displayCategory, element.displayLabel);
		}

		if (element.type === TreeItemType.groupTitle) {
			return localize('groupRowAriaLabel', "{0}, group", element.group.label);
		}

		return '';
	}
}

export enum SearchResultIdx {
	Local = 0,
	Remote = 1
}

export class SearchResultModel {
	private rawSearchResults: ISearchResult[];
	private cachedUniqueSearchResults: ISearchResult[];

	readonly id = 'searchResultModel';

	getUniqueResults(): ISearchResult[] {
		if (this.cachedUniqueSearchResults) {
			return this.cachedUniqueSearchResults;
		}

		if (!this.rawSearchResults) {
			return [];
		}

		const localMatchKeys = new Set();
		const localResult = objects.deepClone(this.rawSearchResults[SearchResultIdx.Local]);
		if (localResult) {
			localResult.filterMatches.forEach(m => localMatchKeys.add(m.setting.key));
		}

		const remoteResult = objects.deepClone(this.rawSearchResults[SearchResultIdx.Remote]);
		if (remoteResult) {
			remoteResult.filterMatches = remoteResult.filterMatches.filter(m => !localMatchKeys.has(m.setting.key));
		}

		this.cachedUniqueSearchResults = [localResult, remoteResult];
		return this.cachedUniqueSearchResults;
	}

	getRawResults(): ISearchResult[] {
		return this.rawSearchResults;
	}

	setResult(type: SearchResultIdx, result: ISearchResult): void {
		this.cachedUniqueSearchResults = null;
		this.rawSearchResults = this.rawSearchResults || [];
		this.rawSearchResults[type] = result;
	}

	resultsAsGroup(): IResolvedTOCEntry {
		const flatSettings: ISetting[] = [];
		this.getUniqueResults()
			.filter(r => !!r)
			.forEach(r => {
				flatSettings.push(
					...r.filterMatches.map(m => m.setting));
			});

		return <IResolvedTOCEntry>{
			id: 'settingsSearchResultGroup',
			settings: flatSettings,
			label: 'searchResults'
		};
	}
}
