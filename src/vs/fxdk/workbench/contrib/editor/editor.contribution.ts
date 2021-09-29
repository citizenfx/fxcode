import { ICodeEditor } from "vs/editor/browser/editorBrowser";
import { EditorAction, registerEditorAction } from "vs/editor/browser/editorExtensions";
import { EditOperation } from "vs/editor/common/core/editOperation";
import { EditorContextKeys } from "vs/editor/common/editorContextKeys";
import { MenuId } from "vs/platform/actions/common/actions";
import { ServicesAccessor } from "vs/platform/instantiation/common/instantiation";
import { IFxDKDataService } from "../../services/fxdkData/fxdkDataService";

function formatArrayOfFloats(arr: number[]): string {
	return arr.map((coord) => coord.toFixed(3)).join(', ');
}

registerEditorAction(class FxDKInsertCurrentPositionAction extends EditorAction {
	public static readonly ID = 'editor.fxdk.insertCurrentPosition';
	public static readonly LABEL = 'Insert player position';

	constructor() {
		super({
			id: FxDKInsertCurrentPositionAction.ID,
			label: FxDKInsertCurrentPositionAction.LABEL,
			precondition: EditorContextKeys.writable,
			alias: FxDKInsertCurrentPositionAction.LABEL,
			menuOpts: {
				order: 1,
				group: 'fxdk',
				title: FxDKInsertCurrentPositionAction.LABEL,
				menuId: MenuId.EditorContext,
			}
		});
	}

	override run(accessor: ServicesAccessor, editor: ICodeEditor) {
		const dataService = accessor.get(IFxDKDataService);

		const pos = dataService.data['player_ped_pos'];
		if (!pos) {
			console.log('No pos yet');
			return;
		}

		editor.executeEdits(this.id, [
			EditOperation.replace(editor.getSelection()!, formatArrayOfFloats(pos)),
		]);
	}
});

registerEditorAction(class FxDKInsertCurrentRotationAction extends EditorAction {
	public static readonly ID = 'editor.fxdk.insertCurrentRotation';
	public static readonly LABEL = 'Insert player rotation';

	constructor() {
		super({
			id: FxDKInsertCurrentRotationAction.ID,
			label: FxDKInsertCurrentRotationAction.LABEL,
			precondition: EditorContextKeys.writable,
			alias: FxDKInsertCurrentRotationAction.LABEL,
			menuOpts: {
				order: 2,
				group: 'fxdk',
				title: FxDKInsertCurrentRotationAction.LABEL,
				menuId: MenuId.EditorContext,
			}
		});
	}

	override run(accessor: ServicesAccessor, editor: ICodeEditor) {
		const dataService = accessor.get(IFxDKDataService);

		const rot = dataService.data['player_ped_rot'];
		if (!rot) {
			console.log('No rot yet');
			return;
		}

		editor.executeEdits(this.id, [
			EditOperation.replace(editor.getSelection()!, formatArrayOfFloats(rot)),
		]);
	}
});

registerEditorAction(class FxDKInsertCurrentHeadingAction extends EditorAction {
	public static readonly ID = 'editor.fxdk.insertCurrentHeading';
	public static readonly LABEL = 'Insert player heading';

	constructor() {
		super({
			id: FxDKInsertCurrentHeadingAction.ID,
			label: FxDKInsertCurrentHeadingAction.LABEL,
			precondition: EditorContextKeys.writable,
			alias: FxDKInsertCurrentHeadingAction.LABEL,
			menuOpts: {
				order: 3,
				group: 'fxdk',
				title: FxDKInsertCurrentHeadingAction.LABEL,
				menuId: MenuId.EditorContext,
			}
		});
	}

	override run(accessor: ServicesAccessor, editor: ICodeEditor) {
		const dataService = accessor.get(IFxDKDataService);

		const heading = dataService.data['player_ped_heading'];
		if (!heading) {
			console.log('No heading yet');
			return;
		}

		editor.executeEdits(this.id, [
			EditOperation.replace(editor.getSelection()!, heading.toFixed(3)),
		]);
	}
});
