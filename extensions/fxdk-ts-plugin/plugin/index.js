const fs = require('fs');
const path = require('path');
const util = require('util');

const wellKnownPathsPath = path.join(process.env.LOCALAPPDATA, 'citizenfx/sdk-storage/well-known-paths.json');
const wellKnownPaths = JSON.parse(fs.readFileSync(wellKnownPathsPath).toString());

function log(msg, ...args) {
	fs.appendFileSync('/dev/test/actual-fxdk-plugin.log', `[${new Date()}] ${msg}\n\t${util.formatWithOptions({
		depth: 10,
	}, args)}\n`);
}

function init() {
  return {
    create(info) {
      info.project.addMissingFileRoot(wellKnownPaths['ts_types_path']);

      return info.languageService;
    },
  };
}

module.exports = init;
