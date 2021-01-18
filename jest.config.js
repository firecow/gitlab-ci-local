module.exports = {
    "roots": [
        "<rootDir>/src"
    ],
    // "collectCoverageFrom" : ["src/**/*.ts"],
    "testMatch": [
        "**/tests/**/*.test.(ts|tsx)",
        "**/?(*.)+(spec|test).+(ts|tsx)"
    ],
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "coverageReporters": [
        "json-summary",
        "text-summary"
    ]
}
