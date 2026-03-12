import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EventEmitter } from "node:events";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const clientHtmlPath = path.join(workspaceRoot, "index.html");
const dispatcherPath = path.join(workspaceRoot, "src", "client", "client-dispatcher.js");
const textProcessorPath = path.join(workspaceRoot, "src", "server", "text-processor.js");
const serverEndpointPath = path.join(workspaceRoot, "src", "server", "server-endpoint.js");

async function main() {
  const dispatcherContent = await readFile(dispatcherPath, "utf8");

  if (process.env.SDLC_TEST_SCENARIO === "fixed_workspace_baseline") {
    assert.equal(dispatcherContent.includes("sendValidationRequest"), true, "Expected ClientDispatcher request logic.");
    assert.equal(dispatcherContent.includes("Content-Type"), true, "Expected JSON request header handling.");
    process.stdout.write("hello-service mock shell check passed.\n");
    return;
  }

  await access(clientHtmlPath);
  const { ClientDispatcher } = await import(pathToFileURL(dispatcherPath).href);
  const { TextProcessor } = await import(pathToFileURL(textProcessorPath).href);
  const { ServerEndpoint } = await import(pathToFileURL(serverEndpointPath).href);

  const endpoint = new ServerEndpoint({
    textProcessor: new TextProcessor(),
  });
  const dispatcher = new ClientDispatcher({
    endpointUrl: "http://hello-service.local/validate",
    fetchImpl: createInMemoryFetch(endpoint),
  });

  const payload = await dispatcher.sendValidationRequest({ text: "hello-service" });
  assert.equal(payload.result, "hello-service from server", "Expected transformed server result.");
  process.stdout.write(`hello-service real shell check passed: ${payload.result}\n`);
}

function createInMemoryFetch(serverEndpoint) {
  return async (url, options = {}) => {
    const request = new MockRequest({
      url: new URL(url).pathname,
      method: options.method ?? "GET",
      body: options.body ?? "",
    });
    const response = new MockResponse();
    const handled = await serverEndpoint.handleRequest(request, response);
    assert.equal(handled, true, "Expected ServerEndpoint to handle the validation request.");

    return {
      ok: response.statusCode >= 200 && response.statusCode < 300,
      status: response.statusCode,
      async json() {
        return JSON.parse(response.body);
      },
    };
  };
}

class MockRequest extends EventEmitter {
  constructor({ url, method, body }) {
    super();
    this.url = url;
    this.method = method;
    queueMicrotask(() => {
      if (body.length > 0) {
        this.emit("data", body);
      }
      this.emit("end");
    });
  }
}

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.body = "";
    this.headers = {};
  }

  setHeader(name, value) {
    this.headers[name] = value;
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = {
      ...this.headers,
      ...headers,
    };
  }

  end(body = "") {
    this.body = body;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
