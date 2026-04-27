import { describe, expect, it } from "vitest"

import { buildBreadcrumbSegments } from "./directory-picker-utils"

describe("directory-picker-utils", () => {
  it("uses the bootstrap root label for the first breadcrumb segment", () => {
    expect(
      buildBreadcrumbSegments(
        "/Users/qiuhao/workspace/harbor-assistant",
        "/Users/qiuhao",
        "Home",
      ),
    ).toEqual([
      { label: "Home", path: "/Users/qiuhao" },
      { label: "workspace", path: "/Users/qiuhao/workspace" },
      {
        label: "harbor-assistant",
        path: "/Users/qiuhao/workspace/harbor-assistant",
      },
    ])
  })

  it("does not generate duplicate breadcrumb entries for the root path", () => {
    expect(
      buildBreadcrumbSegments("/workspace", "/workspace", "Local Files"),
    ).toEqual([{ label: "Local Files", path: "/workspace" }])
  })
})
