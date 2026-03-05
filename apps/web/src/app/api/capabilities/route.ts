import { NextResponse } from "next/server"

import { ERROR_CODES } from "@/constants"
import { getExecutorCapabilities } from "@/services/capability/capability.service"

export const runtime = "nodejs"

export async function GET() {
  try {
    const result = await getExecutorCapabilities()

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: ERROR_CODES.CAPABILITY_CHECK_FAILED,
          message: "Failed to check executor capabilities.",
        },
      },
      {
        status: 500,
      },
    )
  }
}
