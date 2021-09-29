const path = require('path');

process.env.VSCODE_INJECT_NODE_MODULE_LOOKUP_PATH = process.env.FXCODE_DEV_MODE === 'true'
	? path.join(__dirname, '../remote/node_modules')
	: path.join(__dirname, '../node_modules');

module.exports = new Promise((resolve, reject) => {
	require('./bootstrap-node').injectNodeModuleLookupPath(process.env.VSCODE_INJECT_NODE_MODULE_LOOKUP_PATH);
	require('./bootstrap-amd').load('vs/fxdk/node/server', (module) => resolve(module), (error) => reject(error));
});
