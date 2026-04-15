import { createMiddleware, createStart } from "@tanstack/react-start"

const requestContextMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    return next({
      context: {
        request,
      },
    })
  },
)

export const startInstance = createStart(() => ({
  requestMiddleware: [requestContextMiddleware],
}))
