import { Router } from 'express';
import { WebSocketServer } from 'ws';
import { startDemoE2E } from '../runner/index.js';
import { queryByRun, getAllRuns } from '../audit/query.js';
import { addSecret, listSecrets, revokeSecret } from '../vault/store.js';
import pino from 'pino';

const logger = pino();

export function createAPIRouter(wss: WebSocketServer) {
  const router = Router();

  // Broadcast to all WebSocket clients
  function broadcast(data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify(data));
      }
    });
  }

  // Runner endpoints
  router.post('/runner/start', async (req, res) => {
    try {
      broadcast({ type: 'runner', status: 'starting', timestamp: new Date().toISOString() });

      // Capture logs and broadcast them
      const originalLog = console.log;
      console.log = (...args) => {
        originalLog(...args);
        const logStr = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        try {
          const logData = JSON.parse(logStr);
          broadcast({ type: 'log', data: logData });
        } catch {
          broadcast({ type: 'log', data: { message: logStr } });
        }
      };

      await startDemoE2E();

      console.log = originalLog;
      broadcast({ type: 'runner', status: 'completed', timestamp: new Date().toISOString() });

      res.json({ success: true, message: 'Demo started successfully' });
    } catch (error: any) {
      broadcast({ type: 'error', message: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/runner/status', (req, res) => {
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  });

  // Audit endpoints
  router.get('/audit/runs', (req, res) => {
    try {
      const runs = getAllRuns();
      res.json({ success: true, runs });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/audit/run/:runId', (req, res) => {
    try {
      const { runId } = req.params;
      const events = queryByRun(runId);
      res.json({ success: true, runId, events });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vault endpoints
  router.get('/vault/secrets', (req, res) => {
    try {
      const secrets = listSecrets();
      res.json({ success: true, secrets });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/vault/secrets', (req, res) => {
    try {
      const { name, value, scopes } = req.body;
      if (!name || !value || !scopes) {
        return res.status(400).json({ success: false, error: 'Missing required fields: name, value, scopes' });
      }
      const scopeArray = typeof scopes === 'string' ? scopes.split(',').map((s: string) => s.trim()) : scopes;
      const secret = addSecret(name, value, scopeArray);
      res.json({ success: true, secret: { id: secret.id, name: secret.name, scopes: secret.scopes } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/vault/secrets/:id', (req, res) => {
    try {
      const { id } = req.params;
      revokeSecret(id);
      res.json({ success: true, message: `Secret ${id} revoked` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
