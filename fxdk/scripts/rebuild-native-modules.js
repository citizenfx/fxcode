const cp = require('child_process');
const path = require('path');

cp.spawn('..\\fxdk\\node_modules\\.bin\\electron-rebuild.cmd', ['-f'], {
	cwd: path.join(__dirname, '../../remote'),
	shell: true,
	env: process.env,
	stdio: 'inherit',
});
