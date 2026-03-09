# Project Module Error Management

## Overview

Unified error management system for the project module with comprehensive error codes, type-safe error classes, and helper functions.

## Architecture

```
modules/project/
├── errors.ts                # Centralized error management
├── types.ts                 # Domain types (no error codes)
├── project.repository.ts    # Uses ProjectRepositoryError
├── project.service.ts       # Uses ProjectServiceError
└── index.ts                 # Exports all error utilities
```

## Error Classes

### Base Error Class

```typescript
ProjectError extends Error {
  code: ProjectErrorCode
  statusCode: number
  details?: unknown

  toJSON()              // Convert to API response format
  is(code)              // Check specific error type
  isClientError()       // Check if 4xx error
  isServerError()       // Check if 5xx error
}
```

### Specialized Error Classes

**ProjectRepositoryError** - Data access layer errors
- Database operations
- Data validation
- Path resolution

**ProjectServiceError** - Business logic layer errors
- Service-level validation
- Business rule violations
- Orchestration errors

**ProjectValidationError** - Input validation errors
- Field-level validation
- Includes `field` property for specific field errors

## Error Codes

### Validation Errors (400)
- `INVALID_PATH` - Invalid or empty path
- `INVALID_PROJECT_ID` - Invalid or empty project ID
- `INVALID_PROJECT_NAME` - Invalid or empty project name
- `INVALID_SLUG` - Invalid project slug
- `INVALID_STATUS` - Invalid project status
- `INVALID_SETTINGS` - Invalid project settings
- `INVALID_MCP_SERVER_NAME` - Invalid MCP server name
- `NOT_A_DIRECTORY` - Path is not a directory

### Not Found Errors (404)
- `PATH_NOT_FOUND` - Project path does not exist
- `PROJECT_NOT_FOUND` - Project not found
- `PROJECT_SETTINGS_NOT_FOUND` - Project settings not found
- `MCP_SERVER_NOT_FOUND` - MCP server not found

### Conflict Errors (409)
- `DUPLICATE_PATH` - Project path already exists
- `DUPLICATE_SLUG` - Project slug already exists
- `DUPLICATE_MCP_SERVER` - MCP server already configured
- `PROJECT_HAS_ACTIVE_TASKS` - Cannot delete project with active tasks

### Permission Errors (403)
- `PATH_OUTSIDE_ALLOWED_ROOT` - Path outside allowed directory
- `PERMISSION_DENIED` - Permission denied

### Internal Errors (500)
- `DB_READ_ERROR` - Database read error
- `DB_WRITE_ERROR` - Database write error
- `DB_CONNECTION_ERROR` - Database connection error
- `INTERNAL_ERROR` - Internal server error

## Helper Functions

### createProjectError

Convenient factory functions for creating specific errors:

```typescript
// Validation errors
createProjectError.invalidPath(message?, details?)
createProjectError.invalidProjectId(message?, details?)
createProjectError.invalidProjectName(message?, details?)
createProjectError.notADirectory(path)

// Not found errors
createProjectError.pathNotFound(path)
createProjectError.projectNotFound(id)
createProjectError.settingsNotFound(projectId)
createProjectError.mcpServerNotFound(projectId, serverName)

// Conflict errors
createProjectError.duplicatePath(path)
createProjectError.duplicateSlug(slug)
createProjectError.projectHasActiveTasks(projectId, taskCount)

// Database errors
createProjectError.dbReadError(operation, cause?)
createProjectError.dbWriteError(operation, cause?)

// Internal errors
createProjectError.internalError(message, cause?)
```

### Type Guards

```typescript
isProjectError(error)           // Check if ProjectError
isProjectRepositoryError(error) // Check if ProjectRepositoryError
isProjectServiceError(error)    // Check if ProjectServiceError
isProjectValidationError(error) // Check if ProjectValidationError
```

## Usage Examples

### Repository Layer

```typescript
import { createProjectError } from "./errors"

async function resolveProjectPath(rawPath: string): Promise<string> {
  if (!rawPath.trim()) {
    throw createProjectError.invalidPath("Project path cannot be empty")
  }

  try {
    const canonicalPath = await realpath(absolutePath)
    return canonicalPath
  } catch (error) {
    throw createProjectError.pathNotFound(absolutePath)
  }
}

async function addProject(input) {
  try {
    const project = await prisma.project.create({ data })
    return project
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw createProjectError.duplicatePath(canonicalPath)
      }
    }
    throw createProjectError.dbWriteError("create project", error)
  }
}
```

### Service Layer

```typescript
import {
  ProjectServiceError,
  createProjectError,
  isProjectError
} from "./errors"

export async function createProject(input) {
  if (!input.path.trim()) {
    throw createProjectError.invalidPath("Project path is required")
  }

  try {
    return await addProject(input)
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to create project", error)
  }
}
```

### API Layer

```typescript
app.post("/projects", async (request, reply) => {
  try {
    const project = await createProject(request.body)
    return reply.send({ ok: true, project })
  } catch (error) {
    if (isProjectError(error)) {
      return reply.status(error.statusCode).send(error.toJSON())
    }
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    })
  }
})
```

## Error Response Format

All errors are serialized to a consistent JSON format:

```json
{
  "error": {
    "code": "DUPLICATE_PATH",
    "message": "A project with this path already exists: /path/to/project",
    "details": {
      "path": "/path/to/project"
    }
  }
}
```

For validation errors:

```json
{
  "error": {
    "code": "INVALID_PATH",
    "message": "Project path cannot be empty",
    "field": "path",
    "details": {}
  }
}
```

## Benefits

1. **Type Safety** - Full TypeScript support with error code enums
2. **Consistency** - All errors follow the same structure
3. **HTTP Status Mapping** - Automatic HTTP status code assignment
4. **Rich Context** - Errors include detailed context in `details` field
5. **Easy Testing** - Type guards make error testing simple
6. **Developer Experience** - Helper functions reduce boilerplate
7. **API Friendly** - `toJSON()` method for consistent API responses
8. **Maintainability** - Centralized error definitions

## Migration from Old System

**Before:**
```typescript
throw new ProjectRepositoryError(
  "DUPLICATE_PATH",
  `Project path already exists: ${path}`,
)
```

**After:**
```typescript
throw createProjectError.duplicatePath(path)
```

**Benefits:**
- Less boilerplate
- Consistent error messages
- Automatic details population
- Type-safe error codes
