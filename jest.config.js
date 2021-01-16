module.exports = {
    "roots": [
        "<rootDir>/src"
    ],
    "testMatch": [
        "**/tests/**/*.test.(ts|tsx)",
        "**/?(*.)+(spec|test).+(ts|tsx)"
    ],
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "coverageReporters": [
        "json-summary",
    ]
}
