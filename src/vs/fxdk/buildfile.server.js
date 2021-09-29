'use strict';

const { createModuleDescription } = require('../base/buildfile');

exports.collectModules = function () {
	return [
		// createModuleDescription('vs/workbench/services/search/node/searchApp'),

		createModuleDescription('vs/platform/files/node/watcher/parcel/watcherApp'),

		createModuleDescription('vs/platform/terminal/node/ptyHostMain'),

		createModuleDescription('vs/workbench/services/extensions/node/extensionHostProcess'),
	];
};