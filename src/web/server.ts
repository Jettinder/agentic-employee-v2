import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createAPIRouter } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function startWebServer(port: number = 3000) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', createAPIRouter(wss));

  // Serve static files
  app.use(express.static(join(__dirname, 'public')));

  // WebSocket for real-time logs
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Agentic Employee' }));

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  server.listen(port, () => {
    console.log(`\n🚀 Agentic Employee Web UI running at:`);
    console.log(`   http://localhost:${port}`);
    console.log(`   WebSocket: ws://localhost:${port}/ws\n`);
  });

  return { app, server, wss };
}
