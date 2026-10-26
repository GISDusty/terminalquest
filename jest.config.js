module.exports = {
  runner: '@jest-runner/electron',
  testEnvironment: '@jest-runner/electron/environment',
  transform: {
    "^.+\\.jsx?$": "babel-jest"
  },
  modulePaths: ['<rootDir>/public/node_modules'],
  // Agent worktrees live under .claude/worktrees and contain their own copy
  // of src/test, which would otherwise be picked up and run here.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  setupFilesAfterEnv: [
    '<rootDir>/src/test/setup.js'
  ]
};
