import { makeTestRepo, makeTestRepoDir } from '../__tests__/git-utils';
import { expect, testFactory } from './test-utils';
import { cp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const astroPkg = JSON.parse(await readFile(require.resolve('astro/package.json'), 'utf8'));

const testRepoPath = makeTestRepoDir();

const test = testFactory(testRepoPath);

// Increase timeout to account for all the setup commands
// running on CI.
test.setTimeout(120_000);

test.beforeAll(async () => {
	// Setup separate
	const testRepo = makeTestRepo(testRepoPath);

	const repoPath = testRepo.getFilePath('/');

	const sourcePath = new URL('./fixtures/git/', import.meta.url);
	await cp(sourcePath, repoPath, { recursive: true });

	const starlightLinkPath = join(fileURLToPath(import.meta.url), '../../');

	console.log({ starlightLinkPath });

	testRepo.writeFileTree({
		'package.json': JSON.stringify({
			name: 'test-docs',
			private: true,
			type: 'module',
			version: '0.0.1',
			dependencies: {
				astro: astroPkg.version,
			},
		}),
		'.gitignore': 'node_modules\n.astro',
		src: {
			content: {
				docs: {
					'index.md': `---
title: Home Page
lastUpdated: true
---

Home page content
`,
				},
			},
		},
	});

	testRepo.runInRepo('pnpm', ['install']);
	// Add starlight using `pnpm add` so it computes the path to the package on Windows.
	testRepo.runInRepo('pnpm', ['add', '-S', starlightLinkPath]);
	testRepo.commitAllChanges('Add home page', '2024-02-03');
});

test('include last updated date from git in the footer', async ({ page, makeServer }) => {
	const starlight = await makeServer({ mode: 'dev' });
	await starlight.goto('/');

	await expect(page.locator('footer')).toContainText('Last updated: Feb 3, 2024');
});

test('include git information while developing', async ({ page, makeServer }) => {
	const starlight = await makeServer({ mode: 'dev' });
	await starlight.goto('/');

	await expect(page.locator('footer')).toContainText('Last updated: Feb 3, 2024');
});
