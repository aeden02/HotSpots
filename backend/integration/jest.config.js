// Jest config for the integration tests only (unit tests use the "jest" block in package.json).
module.exports = {
    rootDir: __dirname,
    testEnvironment: 'node',
    testTimeout: 60000,
};
