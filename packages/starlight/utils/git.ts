import { basename, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

export function getFileCommitDate(file: string, age: 'oldest' | 'newest' = 'oldest') {
	const args = ['log', '--format=%ct', '--max-count=1'];

	if (age === 'oldest') {
		args.push('--follow', '--diff-filter=A');
	}

	args.push(basename(file));

	const result = spawnSync('git', args, {
		cwd: dirname(file),
		encoding: 'utf-8',
	});

	if (result.error) {
		throw new Error(`Failed to retrieve the git history for file "${file}"`);
	}
	const output = result.stdout.trim();
	const regex = /^(?<timestamp>\d+)$/;
	const match = output.match(regex);

	if (!match?.groups?.timestamp) {
		throw new Error(`Failed to validate the timestamp for file "${file}"`);
	}

	const timestamp = Number(match.groups.timestamp);
	const date = new Date(timestamp * 1000);
	return date;
}
