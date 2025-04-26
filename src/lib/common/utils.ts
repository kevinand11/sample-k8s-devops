import { spawn } from 'node:child_process'

export async function exec (command: string, args: string[] = []) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, { stdio: 'inherit', shell: true });

		child.on('exit', (code) => {
			if (code === 0) return resolve();
			else return reject(new Error(`Process exited with code ${code}`));
		});

		child.on('error', (err) => {
			return reject(err);
		});
  	});
}