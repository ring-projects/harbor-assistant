"use client"

import type { QueryClient } from "@tanstack/react-query"
import { io, type Socket } from "socket.io-client"

import { getTaskSocketBaseUrl } from "@/modules/tasks/api"

import { TaskRealtimeMessageHandler } from "./task-realtime-message-handler"
import type { InteractionMessageEnvelope } from "./task-realtime-protocol"
import { TaskSubscriptionRegistry } from "./task-subscription-registry"

export class TaskSocketManager {
  private socket: Socket | null = null
  private queryClient: QueryClient | null = null
  private readonly messageHandler = new TaskRealtimeMessageHandler(
    () => this.queryClient,
  )
  private readonly subscriptionRegistry = new TaskSubscriptionRegistry(
    (payload) => {
      this.socket?.emit("interaction:subscribe", payload)
    },
    (payload) => {
      this.socket?.emit("interaction:unsubscribe", payload)
    },
  )

  bindQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient
    this.ensureSocket()
  }

  subscribeProject(projectId: string) {
    this.ensureSocket()
    return this.subscriptionRegistry.subscribeProject(projectId)
  }

  subscribeTask(taskId: string) {
    this.ensureSocket()
    return this.subscriptionRegistry.subscribeTask(taskId)
  }

  subscribeProjectGit(projectId: string) {
    this.ensureSocket()
    return this.subscriptionRegistry.subscribeProjectGit(projectId)
  }

  subscribeTaskEvents(taskId: string) {
    this.ensureSocket()
    return this.subscriptionRegistry.subscribeTaskEvents(taskId)
  }

  private ensureSocket() {
    if (this.socket) {
      return
    }

    this.socket = io(getTaskSocketBaseUrl(), {
      path: "/socket.io",
      autoConnect: true,
    })

    this.registerHandlers(this.socket)
  }

  private registerHandlers(socket: Socket) {
    socket.on("connect", () => {
      this.subscriptionRegistry.resubscribeAll()
    })

    socket.on("interaction:message", (payload: InteractionMessageEnvelope) => {
      this.messageHandler.handleMessage(payload)
    })
  }
}

let manager: TaskSocketManager | null = null

export function getTaskSocketManager() {
  manager ??= new TaskSocketManager()
  return manager
}
