export class ServerEndpoint {
  constructor({ textProcessor }) {
    this.textProcessor = textProcessor;
  }

  async handleRequest(request, response) {
    this.writeCorsHeaders(response);

    if (request.method === "OPTIONS" && request.url === "/validate") {
      response.writeHead(204);
      response.end();
      return true;
    }

    if (request.method !== "POST" || request.url !== "/validate") {
      return false;
    }

    const body = await this.readJsonBody(request);
    const inputText = typeof body?.text === "string" ? body.text : "";
    const result = this.textProcessor.process(inputText);

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
    return true;
  }

  writeCorsHeaders(response) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (typeof response.setHeader === "function") {
      for (const [key, value] of Object.entries(headers)) {
        response.setHeader(key, value);
      }
      return;
    }

    response.headers = {
      ...(response.headers ?? {}),
      ...headers,
    };
  }

  readJsonBody(request) {
    return new Promise((resolve, reject) => {
      let rawBody = "";
      request.on("data", (chunk) => {
        rawBody += String(chunk);
      });
      request.on("end", () => {
        try {
          resolve(rawBody.length > 0 ? JSON.parse(rawBody) : {});
        } catch (error) {
          reject(error);
        }
      });
      request.on("error", reject);
    });
  }
}
