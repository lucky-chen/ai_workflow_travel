import http from "node:http";
import { ServerEndpoint } from "./server-endpoint.js";
import { TextProcessor } from "./text-processor.js";

export function createAppServer() {
  const serverEndpoint = new ServerEndpoint({
    textProcessor: new TextProcessor(),
  });

  return http.createServer((request, response) => {
    serverEndpoint.handleRequest(request, response).then((handled) => {
      if (handled) {
        return;
      }

      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Route not found." } }));
    }).catch((error) => {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unexpected server failure.",
        },
      }));
    });
  });
}
