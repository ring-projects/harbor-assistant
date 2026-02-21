import { NextResponse } from "next/server"

import {
  browseDirectory,
  FileBrowserServiceError,
} from "@/services/file-browser/file-browser.service"
import { parseBooleanLike } from "@/utils/boolean"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const path = url.searchParams.get("path") ?? "."
  const depth = Number(url.searchParams.get("depth") ?? "2")
  const includeHidden = parseBooleanLike(url.searchParams.get("includeHidden"))
  const maxEntriesPerDirectory = Number(
    url.searchParams.get("maxEntries") ?? "200"
  )

  try {
    const result = await browseDirectory({
      path,
      depth,
      includeHidden,
      maxEntriesPerDirectory,
    })

    return NextResponse.json({
      ok: true,
      data: result.tree,
      meta: result.meta,
    })
  } catch (error) {
    if (error instanceof FileBrowserServiceError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected error occurred while browsing directory.",
        },
      },
      { status: 500 }
    )
  }
}
