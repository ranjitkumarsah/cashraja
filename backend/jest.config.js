/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/testing/**', '!src/main.ts'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  // Ledger property test runs 500 randomized sequences; give it headroom.
  testTimeout: 30000,
};
