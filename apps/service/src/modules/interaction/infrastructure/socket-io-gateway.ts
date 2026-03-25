import type { FastifyInstance } from "fastify"
import type { Server as HttpServer } from "node:http"
import { Server } from "socket.io"

import { bindWebSocketSession } from "./socket-session"
import type {
  ProjectGitInteractionLifecycle,
  TaskInteractionQueries,
  TaskInteractionStream,
} from "../application/ports"

export function createInteractionSocketGateway(args: {
  app: FastifyInstance
  taskQueries: TaskInteractionQueries
  taskStream: TaskInteractionStream
  projectGitWatcher: ProjectGitInteractionLifecycle
}) {
  const io = new Server(args.app.server as HttpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  })

  io.on("connection", (socket) => {
    bindWebSocketSession({
      socket,
      taskQueries: args.taskQueries,
      taskStream: args.taskStream,
      projectGitWatcher: args.projectGitWatcher,
    })
  })

  args.app.addHook("onClose", async () => {
    if (args.projectGitWatcher.close) {
      await args.projectGitWatcher.close()
    }
    await io.close()
  })

  return io
}
