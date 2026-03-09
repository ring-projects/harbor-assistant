import type {
  AgentCapabilities,
  AgentEvent,
  AgentRunResult,
  AgentSession,
  SessionOptions,
} from "./types"

/**
 * Unified agent interface
 * All AI agent adapters must implement this interface
 */
export interface IAgent {
  /**
   * Get agent type identifier
   */
  getType(): string

  /**
   * Start a new session and run a task
   * @param options Session configuration
   * @param prompt User prompt
   * @param signal Cancellation signal
   * @returns Async event stream
   */
  startSessionAndRun(
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent>

  /**
   * Resume an existing session and run a task
   * @param sessionId Session ID
   * @param options Session configuration
   * @param prompt User prompt
   * @param signal Cancellation signal
   * @returns Async event stream
   */
  resumeSessionAndRun(
    sessionId: string,
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent>

  /**
   * Get agent capabilities information
   * @returns Agent capabilities
   */
  getCapabilities(): Promise<AgentCapabilities>
}
