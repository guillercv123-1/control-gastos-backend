/** @type {import("jest").Config} */
const config = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: [
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  moduleFileExtensions: [
    "ts",
    "js",
    "json"
  ],
  clearMocks: true,
  restoreMocks: true,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json"
      }
    ]
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    "!src/**/index.ts"
  ],
  coverageDirectory: "coverage"
};

module.exports = config;