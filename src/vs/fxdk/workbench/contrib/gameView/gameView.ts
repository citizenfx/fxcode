import 'vs/css!./gameView';
import { $, addDisposableListener, Dimension } from "vs/base/browser/dom";
import { IInstantiationService } from "vs/platform/instantiation/common/instantiation";
import { IStorageService } from "vs/platform/storage/common/storage";
import { ITelemetryService } from "vs/platform/telemetry/common/telemetry";
import { IThemeService } from "vs/platform/theme/common/themeService";
import { EditorPane } from "vs/workbench/browser/parts/editor/editorPane";
import { IEditorSerializer } from "vs/workbench/common/editor";
import { GameViewInput } from "./gameViewInput";
import { GameView, registerGameViewComponent } from './gameViewWebComponent';
import { FxDKDataService, IFxDKDataService } from '../../services/fxdkData/fxdkDataService';

registerGameViewComponent();

export class GameViewPage extends EditorPane {
	public static readonly ID = 'fxdk.gameView';

	private container: HTMLDivElement;
	private gameView: GameView;
	private bar: HTMLDivElement;
	private goFullscreenButton: HTMLButtonElement;

	private pointerLocked = false;

	private active = false;
	private lastSize: Dimension = Dimension.None;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IFxDKDataService private readonly dataService: FxDKDataService,
	) {
		super(GameViewPage.ID, telemetryService, themeService, storageService);

		this.container = $('.fxdk-game-view');
		this.gameView = $('game-view');
		this.bar = $('.fxdk-game-bar');
		this.goFullscreenButton = $('button.fxdk-play-button', {}, 'Go fullscreen');

		this.active = this.dataService.getFXCodeIsActive();

		this._register(this.dataService.onFXCodeIsActiveChange((isActive) => {
			if (isActive) {
				this.gameView.resize(this.lastSize.width, this.lastSize.height);
				this.gameView.unpauseRendering();
			} else {
				this.gameView.pauseRendering();
			}
		}));
	}

	createEditor(parent: HTMLElement) {
		this.bar.appendChild(this.goFullscreenButton);

		this.container.appendChild($('div.fxdk-game-bar-wrapper', {}, this.bar));
		this.container.appendChild(this.gameView);

		if (!this.active) {
			// this.hasBeenActivedAtLeastOnce = true;
			this.gameView.pauseRendering();
		}

		this.setupEvents();

		parent.appendChild(this.container);
	}

	layout(size: Dimension) {
		this.lastSize = size;
		this.gameView.resize(size.width, size.height);
	}

	private setupEvents() {
		this._register(this.onDidFocus(() => {
			this.gameView.focus();
		}));

		this._register(addDisposableListener(this.goFullscreenButton, 'click', this.handleGoFullscreen));
		this._register(addDisposableListener(this.gameView, 'pointerlockchange', this.handleGameviewPointerLockChange));
	}

	private handleGoFullscreen = () => {
		this.gameView.enterFullscreen();
		this.gameView.lockPointer();
	};

	private handleGameviewPointerLockChange = (event: any) => {
		this.pointerLocked = event.detail.locked;

		if (this.pointerLocked) {
			this.bar.classList.add('fxdk-pointer-locked');
		} else {
			this.bar.classList.remove('fxdk-pointer-locked');
		}
	};
}

export class GameViewInputSerializer implements IEditorSerializer {
	public canSerialize(_editorInput: GameViewInput): boolean {
		return true;
	}

	public serialize(_editorInput: GameViewInput): string {
		return 'fxdk.gameView.main';
	}

	public deserialize(instantiationService: IInstantiationService, _serializedEditorInput: string): GameViewInput {
		return instantiationService.createInstance(GameViewInput);
	}
}
