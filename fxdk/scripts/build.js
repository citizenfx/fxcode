const cp = require('child_process');
const path = require('path');

cp.spawn('yarn', ['gulp', 'fxdk-min'], {
	cwd: path.join(__dirname, '../..'),
	shell: true,
	env: process.env,
	stdio: 'inherit',
});