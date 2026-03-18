import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../repositories", () => ({
  runGitCommand: vi.fn(),
}))

import { runGitCommand } from "../repositories"
import { readProjectGitDiff } from "./git-diff.service"

const mockedRunGitCommand = vi.mocked(runGitCommand)

describe("readProjectGitDiff", () => {
  beforeEach(() => {
    mockedRunGitCommand.mockReset()
  })

  it("surfaces spawn failures instead of misreporting a non-repository path", async () => {
    mockedRunGitCommand
      .mockResolvedValueOnce({
        stdout: "abc123\n",
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "spawn EBADF",
        exitCode: null,
      })

    await expect(
      readProjectGitDiff({
        projectId: "project-1",
        projectPath: "/repo",
      }),
    ).rejects.toThrow("spawn EBADF")

    expect(mockedRunGitCommand).toHaveBeenNthCalledWith(
      1,
      ["rev-parse", "--verify", "HEAD"],
      "/repo",
    )
    expect(mockedRunGitCommand).toHaveBeenNthCalledWith(
      2,
      [
        "diff",
        "-U1",
        "--no-color",
        "--no-ext-diff",
        "--find-renames",
        "--find-copies",
        "--binary",
        "HEAD",
        "--",
      ],
      "/repo",
    )
  })
})
