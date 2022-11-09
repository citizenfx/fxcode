const path = require('path');
const { dirs } = require('../../build/npm/dirs');
const utils = require('./utils');

const extDirs = dirs
	.filter((dir) => dir.startsWith('extensions/'))
	.map((dir) => path.join(__dirname, '../..', dir));

const print = utils.modulePrint('compile-extensions', utils.Color.FgGreen);

(async () => {
	print('Updating extensions deps');

	for (const extDir of extDirs) {
		await utils.yarn('deps:' + path.basename(extDir), extDir, 'install', '--ignore-engines');
	}

	print('Compiling extensions');

	await utils.yarn('compilation', path.join(__dirname, '../..'), 'gulp', 'compile-extensions');
})();
