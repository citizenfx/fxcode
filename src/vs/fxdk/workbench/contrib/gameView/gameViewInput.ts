import 'vs/css!./gameView';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import { EditorInputCapabilities, IUntypedEditorInput } from 'vs/workbench/common/editor';
import { IFxDKDataService } from '../../services/fxdkData/fxdkDataService';
import { GameStates } from 'vs/fxdk/browser/glue';

const gameStateToDescription: Record<GameStates, string> = {
	[GameStates.NOT_RUNNING]: 'Not running',
	[GameStates.READY]: 'Ready',
	[GameStates.LOADING]: 'Loading',
	[GameStates.UNLOADING]: 'Unloading',
	[GameStates.CONNECTED]: 'Active'
};

export const gameViewInputTypeId = 'fxdk.gameViewInput';

export class GameViewInput extends EditorInput {

	static readonly ID = gameViewInputTypeId;
	static readonly RESOURCE = URI.from({ scheme: Schemas.vscodeCustomEditor, authority: 'fxcode_game_view_page' });

	constructor(
		@IFxDKDataService private readonly dataService: IFxDKDataService,
	) {
		super();

		this._register(this.dataService.onGameStateChange(() => {
			this._onDidChangeLabel.fire();
		}));
	}

	override get typeId(): string {
		return GameViewInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton | EditorInputCapabilities.ForceDescription;
	}

	get resource(): URI | undefined {
		return GameViewInput.RESOURCE;
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (other instanceof GameViewInput) {
			return true;
		}

		return false;
	}

	override getName() {
		return 'Game';
	}

	override getDescription() {
		return gameStateToDescription[this.dataService.getGameState()];
	}
}
