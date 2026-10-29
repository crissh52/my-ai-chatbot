"use strict";

const { createSupervisorServer } = require("../supervisor/server.cjs");
const server = createSupervisorServer();
server.requestTimeout = 35000;
server.headersTimeout = 10000;
server.listen(8892, "127.0.0.1", () => {
  console.log("Supervisor local: http://127.0.0.1:8892");
  console.log("Public GitHub reads only, on button click. No key, AI or Netlify requests.");
  console.log("Press Ctrl+C to stop.");
});
server.on("error", () => {
  console.error("Cannot start local Supervisor. Check whether port 8892 is already in use.");
  process.exitCode = 1;
});
process.once("SIGINT", () => server.close(() => process.exit(0)));
process.once("SIGTERM", () => server.close(() => process.exit(0)));
