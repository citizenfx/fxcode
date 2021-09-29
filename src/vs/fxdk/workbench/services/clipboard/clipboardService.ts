import { BrowserClipboardService } from "vs/platform/clipboard/browser/clipboardService";
import { IClipboardService } from "vs/platform/clipboard/common/clipboardService";
import { registerSingleton } from "vs/platform/instantiation/common/extensions";

export class FxDKClipboardService extends BrowserClipboardService {
	override async readText(type?: string) {
		if (type) {
			return super.readText(type);
		}

		return fxdkClipboardRead();
	}

	override async writeText(text: string, type?: string) {
		if (type) {
			return super.writeText(text, type);
		}

		return fxdkClipboardWrite(text);
	}
}

registerSingleton(IClipboardService, FxDKClipboardService, true);