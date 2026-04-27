export type ProjectSandboxIdParams = {
  projectId: string
}

export type SandboxIdParams = {
  sandboxId: string
}

export type SandboxCommandIdParams = {
  sandboxId: string
  commandId: string
}

export type SandboxSnapshotIdParams = {
  snapshotId: string
}

export type SandboxPreviewParams = {
  sandboxId: string
  port: number
}

export type CreateSandboxBody = {
  mode?: "safe" | "connected" | "full-access"
  purpose?: "task-run" | "task-prepare" | "preview" | "development" | "ad-hoc"
  taskId?: string | null
  labels?: Record<string, string>
}

export type StartSandboxCommandBody = {
  command: string
  cwd?: string | null
  env?: Record<string, string>
  detached?: boolean
}

const sandboxMetadataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["workspaceId", "projectId", "taskId", "purpose", "labels"],
  properties: {
    workspaceId: { type: ["string", "null"] },
    projectId: { type: ["string", "null"] },
    taskId: { type: ["string", "null"] },
    purpose: {
      type: "string",
      enum: ["task-run", "task-prepare", "preview", "development", "ad-hoc"],
    },
    labels: {
      type: "object",
      additionalProperties: {
        type: "string",
      },
    },
  },
} as const

const sandboxSourceSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: { type: "string", const: "empty" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "path"],
      properties: {
        type: { type: "string", const: "directory" },
        path: { type: "string", minLength: 1 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "repositoryUrl", "ref"],
      properties: {
        type: { type: "string", const: "git" },
        repositoryUrl: { type: "string", minLength: 1 },
        ref: { type: ["string", "null"] },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "tarballUrl"],
      properties: {
        type: { type: "string", const: "tarball" },
        tarballUrl: { type: "string", minLength: 1 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "snapshotId"],
      properties: {
        type: { type: "string", const: "snapshot" },
        snapshotId: { type: "string", minLength: 1 },
      },
    },
  ],
} as const

const sandboxProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "vcpuCount",
    "memoryMb",
    "idleTimeoutSeconds",
    "maxDurationSeconds",
  ],
  properties: {
    vcpuCount: { type: "integer", minimum: 1 },
    memoryMb: { type: "integer", minimum: 1 },
    idleTimeoutSeconds: { type: "integer", minimum: 1 },
    maxDurationSeconds: { type: "integer", minimum: 1 },
  },
} as const

const sandboxNetworkPolicySchema = {
  type: "object",
  additionalProperties: false,
  required: ["outboundMode", "allowedHosts"],
  properties: {
    outboundMode: {
      type: "string",
      enum: ["deny-all", "allow-all", "allow-list"],
    },
    allowedHosts: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
} as const

const sandboxEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "provider",
    "providerSandboxId",
    "mode",
    "status",
    "source",
    "workingDirectory",
    "profile",
    "networkPolicy",
    "metadata",
    "previewBaseUrl",
    "failureReason",
    "createdAt",
    "updatedAt",
    "lastReadyAt",
    "stoppedAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    provider: { type: "string", enum: ["docker"] },
    providerSandboxId: { type: "string", minLength: 1 },
    mode: { type: "string", enum: ["safe", "connected", "full-access"] },
    status: {
      type: "string",
      enum: ["provisioning", "ready", "stopping", "stopped", "failed"],
    },
    source: sandboxSourceSchema,
    workingDirectory: { type: "string", minLength: 1 },
    profile: sandboxProfileSchema,
    networkPolicy: sandboxNetworkPolicySchema,
    metadata: sandboxMetadataSchema,
    previewBaseUrl: { type: ["string", "null"] },
    failureReason: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    lastReadyAt: { type: ["string", "null"], format: "date-time" },
    stoppedAt: { type: ["string", "null"], format: "date-time" },
  },
} as const

const sandboxCommandSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "sandboxId",
    "providerCommandId",
    "command",
    "cwd",
    "detached",
    "status",
    "exitCode",
    "errorMessage",
    "createdAt",
    "updatedAt",
    "startedAt",
    "finishedAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    sandboxId: { type: "string", minLength: 1 },
    providerCommandId: { type: "string", minLength: 1 },
    command: { type: "string", minLength: 1 },
    cwd: { type: ["string", "null"] },
    detached: { type: "boolean" },
    status: {
      type: "string",
      enum: ["queued", "running", "completed", "failed", "cancelled"],
    },
    exitCode: { type: ["integer", "null"] },
    errorMessage: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    startedAt: { type: ["string", "null"], format: "date-time" },
    finishedAt: { type: ["string", "null"], format: "date-time" },
  },
} as const

const sandboxSnapshotSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "sandboxId",
    "providerSnapshotId",
    "providerSnapshotRef",
    "createdAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    sandboxId: { type: "string", minLength: 1 },
    providerSnapshotId: { type: "string", minLength: 1 },
    providerSnapshotRef: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
  },
} as const

export const createSandboxRouteSchema = {
  tags: ["sandbox"],
  operationId: "createProjectSandbox",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["projectId"],
    properties: {
      projectId: { type: "string", minLength: 1 },
    },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      mode: {
        type: "string",
        enum: ["safe", "connected", "full-access"],
      },
      purpose: {
        type: "string",
        enum: ["task-run", "task-prepare", "preview", "development", "ad-hoc"],
      },
      taskId: { type: ["string", "null"], minLength: 1 },
      labels: {
        type: "object",
        additionalProperties: {
          type: "string",
        },
      },
    },
  },
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "sandbox"],
      properties: {
        ok: { type: "boolean", const: true },
        sandbox: sandboxEntitySchema,
      },
    },
  },
} as const

export const listProjectSandboxesRouteSchema = {
  tags: ["sandbox"],
  operationId: "listProjectSandboxes",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["projectId"],
    properties: {
      projectId: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "sandboxes"],
      properties: {
        ok: { type: "boolean", const: true },
        sandboxes: {
          type: "array",
          items: sandboxEntitySchema,
        },
      },
    },
  },
} as const

export const getSandboxRouteSchema = {
  tags: ["sandbox"],
  operationId: "getSandbox",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["sandboxId"],
    properties: {
      sandboxId: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "sandbox"],
      properties: {
        ok: { type: "boolean", const: true },
        sandbox: sandboxEntitySchema,
      },
    },
  },
} as const

export const deleteSandboxRouteSchema = {
  tags: ["sandbox"],
  operationId: "deleteSandbox",
  params: getSandboxRouteSchema.params,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "sandbox"],
      properties: {
        ok: { type: "boolean", const: true },
        sandbox: sandboxEntitySchema,
      },
    },
  },
} as const

export const startSandboxCommandRouteSchema = {
  tags: ["sandbox"],
  operationId: "startSandboxCommand",
  params: getSandboxRouteSchema.params,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["command"],
    properties: {
      command: { type: "string", minLength: 1 },
      cwd: { type: ["string", "null"], minLength: 1 },
      env: {
        type: "object",
        additionalProperties: {
          type: "string",
        },
      },
      detached: { type: "boolean" },
    },
  },
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "command"],
      properties: {
        ok: { type: "boolean", const: true },
        command: sandboxCommandSchema,
      },
    },
  },
} as const

export const getSandboxCommandRouteSchema = {
  tags: ["sandbox"],
  operationId: "getSandboxCommand",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["sandboxId", "commandId"],
    properties: {
      sandboxId: { type: "string", minLength: 1 },
      commandId: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "command"],
      properties: {
        ok: { type: "boolean", const: true },
        command: sandboxCommandSchema,
      },
    },
  },
} as const

export const listSandboxCommandsRouteSchema = {
  tags: ["sandbox"],
  operationId: "listSandboxCommands",
  params: getSandboxRouteSchema.params,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "commands"],
      properties: {
        ok: { type: "boolean", const: true },
        commands: {
          type: "array",
          items: sandboxCommandSchema,
        },
      },
    },
  },
} as const

export const createSandboxSnapshotRouteSchema = {
  tags: ["sandbox"],
  operationId: "createSandboxSnapshot",
  params: getSandboxRouteSchema.params,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "snapshot"],
      properties: {
        ok: { type: "boolean", const: true },
        snapshot: sandboxSnapshotSchema,
      },
    },
  },
} as const

export const listSandboxSnapshotsRouteSchema = {
  tags: ["sandbox"],
  operationId: "listSandboxSnapshots",
  params: getSandboxRouteSchema.params,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "snapshots"],
      properties: {
        ok: { type: "boolean", const: true },
        snapshots: {
          type: "array",
          items: sandboxSnapshotSchema,
        },
      },
    },
  },
} as const

export const restoreSandboxSnapshotRouteSchema = {
  tags: ["sandbox"],
  operationId: "restoreSandboxSnapshot",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["snapshotId"],
    properties: {
      snapshotId: { type: "string", minLength: 1 },
    },
  },
  body: createSandboxRouteSchema.body,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "sandbox"],
      properties: {
        ok: { type: "boolean", const: true },
        sandbox: sandboxEntitySchema,
      },
    },
  },
} as const

export const getSandboxPreviewRouteSchema = {
  tags: ["sandbox"],
  operationId: "getSandboxPreview",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["sandboxId", "port"],
    properties: {
      sandboxId: { type: "string", minLength: 1 },
      port: { type: "integer", minimum: 1, maximum: 65535 },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "url"],
      properties: {
        ok: { type: "boolean", const: true },
        url: { type: "string", minLength: 1 },
      },
    },
  },
} as const
