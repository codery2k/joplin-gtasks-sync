import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'dist/**',
			'publish/**',
			'node_modules/**',
			'api/**',
			'webpack.config.js',
			'coverage/**',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['src/**/*.ts', 'test/**/*.ts'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		},
	},
	{
		files: ['src/core/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['api', 'api/*', '**/api', '**/api/*'],
							message: 'src/core must stay pure — do not import the Joplin API.',
						},
						{
							group: [
								'axios',
								'got',
								'node-fetch',
								'undici',
								'node:http',
								'node:https',
								'http',
								'https',
								'node:net',
							],
							message: 'src/core must stay pure — do not import HTTP libraries. I/O belongs in ports/adapters.',
						},
					],
				},
			],
		},
	},
);
