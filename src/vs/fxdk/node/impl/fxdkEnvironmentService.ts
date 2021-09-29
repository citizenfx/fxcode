import * as path from 'path';
import * as os from 'os';
import { memoize } from 'vs/base/common/decorators';
import { NativeParsedArgs } from 'vs/platform/environment/common/argv';
import { IProductService } from 'vs/platform/product/common/productService';
import { resolve } from 'vs/base/common/path';
import { INativeEnvironmentService } from 'vs/platform/environment/common/environment';
import { AbstractNativeEnvironmentService } from 'vs/platform/environment/common/environmentService';

export interface IFxDKEnvironmentService extends INativeEnvironmentService {
	extraExtensionPaths: string[],
	extraBuiltinExtensionPaths: string[],
}

const cfxLocalAppData = path.join(process.env.LOCALAPPDATA || (() => { throw new Error('No LOCALAPPDATA') })(), 'citizenfx');

export class FxDKEnvironmentService extends AbstractNativeEnvironmentService implements IFxDKEnvironmentService {
	private __args: any;

	constructor(args: NativeParsedArgs, productService: IProductService) {
		super(args, {
			homeDir: path.join(cfxLocalAppData, 'sdk-personality-fxcode/home'),
			userDataDir: path.join(cfxLocalAppData, 'sdk-personality-fxcode/user'),
			tmpDir: os.tmpdir(),
		}, productService);

		this.__args = args;
	}

	@memoize
	get extraExtensionPaths(): string[] {
		return (this.__args['extra-extensions-dir'] || []).map((p: any) => resolve(p));
	}

	@memoize
	get extraBuiltinExtensionPaths(): string[] {
		return [
			path.join(cfxLocalAppData, 'sdk-personality-fxcode/builtin-extensions'),
		];
	}

	@memoize
	override get extensionsPath(): string {
		return path.join(cfxLocalAppData, 'sdk-personality-fxcode/user-extensions');
	}
}
