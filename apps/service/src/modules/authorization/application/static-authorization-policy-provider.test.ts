import { describe, expect, it } from "vitest"

import { createStaticAuthorizationPolicyProvider } from "./static-authorization-policy-provider"

describe("createStaticAuthorizationPolicyProvider", () => {
  it("resolves derived project actions for task and orchestration actions", () => {
    const provider = createStaticAuthorizationPolicyProvider()

    expect(provider.getDerivedProjectAction("task.resume")).toBe(
      "project.tasks.create",
    )
    expect(provider.getDerivedProjectAction("orchestration.view")).toBe(
      "project.view",
    )
  })

  it("reads role effects from the centralized action tables", () => {
    const provider = createStaticAuthorizationPolicyProvider()

    expect(
      provider.getWorkspaceRoleEffect("workspace_member", "project.create"),
    ).toBe("deny")
    expect(
      provider.getProjectRoleEffect("workspace_member", "project.files.read"),
    ).toBe("allow")
    expect(
      provider.getProjectRoleEffect("workspace_member", "project.files.write"),
    ).toBe("deny")
  })
})
