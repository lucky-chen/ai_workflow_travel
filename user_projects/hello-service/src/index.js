import { createAppServer } from "./server/app-server.js";

export async function startServer(options = {}) {
  const { port = Number(process.env.PORT ?? 3000) } = options;
  const server = createAppServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return server;
}

const isMainModule = process.argv[1]
  && new URL(`file://${process.argv[1]}`).href === import.meta.url;

if (isMainModule) {
  const server = await startServer();
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : process.env.PORT ?? 3000;
  process.stdout.write(`hello-service listening on ${actualPort}\n`);
}
