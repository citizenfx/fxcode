import "vs";

declare global {
	var resizeGame: (width: number, height: number) => void;
	var initRGDInput: () => boolean;
	var setMouseButtonState: (button: number, state: boolean) => void;
	var sendMouseWheel: (deltaY: number) => void;
	// var sendMousePos: (mx: number, my: number) => void;
	var setRawMouseCapture: (capture: boolean) => void;
	var setKeyState: (vk: number, state: boolean) => void;
	var setInputChar: (char: string) => void;

	var sendGameClientEvent: (eventName: string, payload: string) => void | boolean;

	var setWorldEditorMouse: (x: number, y: number) => void | boolean;
	var setWorldEditorControls: (select: boolean, mode: number, local: boolean) => void | boolean;

	var openDevTools: () => void;
	var invokeNative: (native: string, ...arg: string[]) => void;
	var renderGame: () => void;
	var setFPSLimit: (limit: number) => void;
	var fxdkSendApiMessage: (msg: string) => boolean;
	var fxdkOpenSelectFolderDialog: (startPath: string, dialogTitle: string, callback: (selectedFolder: string | null) => void) => boolean;
	var fxdkOpenSelectFileDialog: (startPath: string, dialogTitle: string, callback: (selectedFolder: string | null) => void) => boolean;

	var fxdkClipboardRead: () => string;
	var fxdkClipboardWrite: (text: string) => void;
}