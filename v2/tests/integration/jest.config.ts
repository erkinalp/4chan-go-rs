import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.test.ts'],
  setupFilesAfterFramework: [],
  globalSetup: './setup.ts',
  globalTeardown: './teardown.ts',
  testTimeout: 30000,
  verbose: true,
};

export default config;
