import type { FastifyInstance } from "fastify"
import type { Server as HttpServer } from "node:http"
import { Server, type Socket } from "socket.io"

import { bindWebSocketSession } from "./socket-session"
import type {
  ProjectGitInteractionLifecycle,
  TaskInteractionQueries,
  TaskInteractionStream,
} from "../application/ports"
import type { AuthorizationActor, AuthorizationService } from "../../authorization"

export type ResolveSocketActor = (
  socket: Socket,
) => Promise<AuthorizationActor | null>

export function createInteractionSocketGateway(args: {
  app: FastifyInstance
  authorization: AuthorizationService
  taskQueries: TaskInteractionQueries
  taskStream: TaskInteractionStream
  projectGitWatcher: ProjectGitInteractionLifecycle
  resolveSocketActor: ResolveSocketActor
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
      actorPromise: args.resolveSocketActor(socket).catch(() => null),
      authorization: args.authorization,
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
