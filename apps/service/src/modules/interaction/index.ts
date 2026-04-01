export type {
  InteractionSubscribeRequest,
  InteractionProjectGitChangeEvent,
  InteractionTaskEventItem,
  InteractionTaskEventsSnapshotMessage,
  InteractionTaskEventStream,
  InteractionTaskMessage,
  InteractionTaskRecord,
  InteractionTaskSnapshotMessage,
  InteractionTaskStatus,
  InteractionTaskStreamMessage,
  InteractionTaskTopic,
  InteractionTopic,
  InteractionTopicKind,
  ProjectGitInteractionLifecycle,
  ProjectGitInteractionWatcher,
  TaskInteractionQueries,
  TaskInteractionSubscription,
  TaskInteractionSubscriptionHandle,
  TaskInteractionStream,
} from "./application/ports"
export {
  INTERACTION_ERROR_CODES,
  InteractionError,
  createInteractionError,
  isInteractionError,
  toInteractionMessageError,
} from "./errors"
export type { InteractionMessageError } from "./errors"
export { createInteractionSocketGateway } from "./infrastructure/socket-io-gateway"
