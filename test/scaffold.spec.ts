import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('M0 scaffold', () => {
	it('enforces the core-purity import rule in eslint config', () => {
		const config = readFileSync(resolve(__dirname, '../eslint.config.mjs'), 'utf8');
		expect(config).toContain('src/core/**/*.ts');
		expect(config).toContain('no-restricted-imports');
		expect(config).toContain('src/core must stay pure');
	});
});
