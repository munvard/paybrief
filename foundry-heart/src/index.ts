import http from "node:http";

const PORT = Number(process.env.PORT ?? 8080);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "foundry-heart", time: new Date().toISOString() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => console.log(`[heart] listening on :${PORT}`));

setInterval(() => console.log(`[heart] tick ${new Date().toISOString()}`), 15 * 60 * 1000);
