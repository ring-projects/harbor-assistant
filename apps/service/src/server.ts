import { createServer } from "node:http"

const port = Number(process.env.EXECUTOR_PORT ?? 3400)

const server = createServer((request, response) => {
  const pathname = request.url?.split("?")[0] ?? "/"
  response.setHeader("Content-Type", "application/json")

  if (pathname === "/healthz") {
    response.statusCode = 200
    response.end(
      JSON.stringify({
        ok: true,
        service: "service",
        port,
        timestamp: new Date().toISOString(),
      }),
    )
    return
  }

  response.statusCode = 404
  response.end(
    JSON.stringify({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    }),
  )
})

server.listen(port, () => {
  console.info(`[service] listening on http://localhost:${port}`)
})
