import * as path from 'path';
import { URI, UriComponents } from 'vs/base/common/uri';
import { URITransformer } from 'vs/base/common/uriIpc';
// import rawURITransformerFactory = require('vs/fxdk/node/uriTransformer');

const serverUriTransformerPath = path.join(__dirname, '../../../serverUriTransformer.js');
const factory = <any>require.__$__nodeRequire(serverUriTransformerPath);

export const getUriTransformer = (remoteAuthority: string): URITransformer => {
	return new URITransformer(factory(remoteAuthority));
};

export function transformIncoming(remoteAuthority: string, uri: UriComponents | undefined): URI | undefined {
	const transformer = getUriTransformer(remoteAuthority);
	return uri ? URI.revive(transformer.transformIncoming(uri)) : uri;
}

