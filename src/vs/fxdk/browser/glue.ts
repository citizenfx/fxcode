import { Color } from "vs/base/common/color";

export interface IDisposable {
	dispose(): void
}

export enum GameStates {
	NOT_RUNNING,
	READY,
	LOADING,
	CONNECTED,
	UNLOADING,
}

export interface StructuredMessage {
	channel: string;
	message: string;
}

export interface ResourceColors {
	bg: string,
	bgRaw: Color,

	fg: string,
	fgRaw: Color,
}

export type ResourceName = string;
export type ResourceAvgTickMs = number;
export type ResourceAvgFrameFraction = number;
export type ResourceMemorySize = number;
export type ResourceStreamingSize = number;
export type ClientResourceData = [ResourceName, ResourceAvgTickMs, ResourceAvgFrameFraction, ResourceMemorySize, ResourceStreamingSize];
export type ServerResourceData = ClientResourceData;

export interface IFxDKDataServiceBase {
	readonly _serviceBrand: undefined;

	readonly data: { [key: string]: any },
	acceptData(data: { key: string, value: any}[] | { key: string, value: any }): void,

	onBufferedServerOutputChanged(cb: (output: string) => void): IDisposable,
	onStructuredServerMessageReceived(cb: (st: StructuredMessage) => void): IDisposable,
	onClearAllServerOutputs(cb: () => void): IDisposable,
	onClientResourcesData(cb: (data: ClientResourceData[]) => void): IDisposable,

	getClientResourcesData(): ClientResourceData[],
	setClientResourcesData(data: ClientResourceData[]): void,

	onServerResourcesData(cb: (data: ServerResourceData[]) => void): IDisposable,
	getServerResourcesData(): ServerResourceData[],
	setServerResourcesData(data: ServerResourceData[]): void,

	getBufferedServerOutput(): string,
	getStructuredServerMessages(): StructuredMessage[],
	clearAllServerOutputs(): void,

	setBufferedServerOutput(output: string): void,
	receiveStructuredServerMessage(message: StructuredMessage): void,

	onStructuredGameMessageReceived(cb: (st: StructuredMessage) => void): IDisposable,
	onClearGameOutput(cb: () => void): IDisposable,
	getStructuredGameMessages(): StructuredMessage[],
	receiveStructuredGameMessage(message: StructuredMessage): void,
	clearGameOutput(): void,

	onFXCodeIsActiveChange(cb: (isActive: boolean) => void): IDisposable,
	setFXCodeIsActive(isActive: boolean): void,
	getFXCodeIsActive(): boolean,

	onGameStateChange(cb: (gameState: GameStates) => void): IDisposable,
	getGameState(): GameStates,
	setGameState(gameState: GameStates): void,

	getResourceColors(resourceName: string): ResourceColors,
}

export interface IFxDKGlue {
	readonly dataService: IFxDKDataServiceBase,

	openProjectFile(filepath: string, pinned: boolean): Promise<void>,
	findInFiles(entryPath: string): void,
	emitFileDeleted(filepath: string): void,
	emitFileMoved(from: string, to: string): Promise<void>,
	installExtensions(ids: string[]): Promise<void>,
	openGameView(): void,
}

export type IWindowWithFxDKGlue = (typeof window) & { fxdkGlue: IFxDKGlue };