import { describe, expect, it } from "vitest"

import {
  interactionTopicKey,
  parseInteractionSubscription,
} from "./subscription-topics"

describe("interaction subscription topics", () => {
  it("parses task-events subscription with normalized cursor and limit", () => {
    expect(
      parseInteractionSubscription({
        topic: {
          kind: "task-events",
          id: " task-1 ",
        },
        afterSequence: -10,
        limit: 0,
      }),
    ).toEqual({
      topic: {
        kind: "task-events",
        id: "task-1",
      },
      room: "task-events:task-1",
      afterSequence: 0,
      limit: 500,
    })
  })

  it("rejects invalid topic inputs and builds stable topic keys", () => {
    expect(
      parseInteractionSubscription({
        topic: {
          kind: "task",
          id: "  ",
        },
      }),
    ).toBeNull()
    expect(
      parseInteractionSubscription({
        topic: {
          kind: "unknown",
          id: "x",
        } as never,
      }),
    ).toBeNull()
    expect(
      interactionTopicKey({
        kind: "project-git",
        id: "project-1",
      }),
    ).toBe("project-git:project-1")
  })
})
