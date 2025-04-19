# Contribution Guide

Thank you for your interest in contributing to the 4chan modernization project! This document provides guidelines for effectively contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Requesting Features](#requesting-features)
  - [Pull Requests](#pull-requests)
- [Code Standards](#code-standards)
  - [JavaScript/TypeScript](#javascripttypescript)
  - [CSS/SCSS](#cssscss)
  - [Tests](#tests)
- [Development Process](#development-process)
  - [Branching Strategy](#branching-strategy)
  - [Commit Messages](#commit-messages)
  - [Code Review](#code-review)
- [Development Environment Setup](#development-environment-setup)
- [Additional Resources](#additional-resources)

## Code of Conduct

This project and all its participants are governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to comply with this code. Please report unacceptable behavior to [conduct@example.org].

## How to Contribute

### Reporting Bugs

Bugs are reported through [GitHub Issues](https://github.com/username/4chan/issues). Before creating a new bug report, please verify if a similar one already exists.

When reporting a bug, include:
- A clear and descriptive title
- Steps to reproduce the problem
- Expected behavior vs. actual behavior
- Screenshots (if applicable)
- Environment information (operating system, browser, versions)

### Requesting Features

Feature requests are also handled through GitHub Issues. Provide:
- Clear description of the problem the feature would solve
- Explanation of how it would help users
- Any references or examples of similar implementations

### Pull Requests

1. Fork the repository and create your branch from `main`
2. If you add code, add tests that cover your code
3. If you change APIs, update the documentation
4. Ensure tests pass
5. Ensure your code meets our standards
6. Submit your Pull Request!

## Code Standards

### JavaScript/TypeScript

- We follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- We use TypeScript for all new code
- JSDoc documentation is required for all public functions

### CSS/SCSS

- We use BEM (Block Element Modifier) for class naming
- We prefer SCSS over plain CSS
- We keep specificity to a minimum

### Tests

- Test coverage is required for all new code (target: >80%)
- We use Jest for unit tests
- Cypress for end-to-end tests
- Tests should be readable and maintainable

## Development Process

### Branching Strategy

We follow a GitFlow-based model:
- `main`: Production code
- `develop`: Main development branch
- `feature/*`: For new features
- `bugfix/*`: For bug fixes
- `release/*`: For release preparation
- `hotfix/*`: For urgent fixes in production

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

Main types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect code meaning
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or fixing tests
- `chore`: Changes to the build process or auxiliary tools

### Code Review

- Each PR requires at least one approval
- Comments should be constructive and clear
- Authors are expected to respond to comments in a timely manner

## Development Environment Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Copy `.env.example` to `.env` and configure the variables
4. Start the development environment with `npm run dev`
5. Run tests with `npm test`

To set up the database:
1. Install PostgreSQL and Redis
2. Run migrations with `npm run db:migrate`
3. (Optional) Load test data with `npm run db:seed`

## Additional Resources

- [API Documentation](docs/api.md)
- [Architecture Guide](docs/architecture.md)
- [Migration Plan](docs/migration.md)

---

Thank you for contributing to the 4chan modernization! Your efforts help preserve and improve an important part of internet culture.
