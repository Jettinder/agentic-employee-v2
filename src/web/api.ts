/**
 * Web API Routes
 * REST and WebSocket API for the agent
 */

import { Router } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { startDemoE2E } from '../runner/index.js';
import { queryByRun, getAllRuns } from '../audit/query.js';
import { addSecret, listSecrets, revokeSecret } from '../vault/store.js';
import { runObjective, createAgentLoop, AgentResult } from '../core/agent-loop.js';
import { generatePlan } from '../planner/index.js';
import { getMemoryStore } from '../memory/index.js';
import type { RunContext } from '../core/types.js';
import type { Message } from '../ai/types.js';

// Active chat sessions
const chatSessions = new Map<string, {
  messages: Message[];
  ctx: RunContext;
}>();

export function createAPIRouter(wss: WebSocketServer) {
  const router = Router();

  // Broadcast to all WebSocket clients
  function broadcast(data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // ============ AGENT ENDPOINTS ============

  /**
   * POST /api/agent/run
   * Run agent with an objective
   */
  router.post('/agent/run', async (req, res) => {
    try {
      const { objective, verbose, maxIterations, maxToolCalls } = req.body;

      if (!objective) {
        return res.status(400).json({ success: false, error: 'Objective is required' });
      }

      broadcast({ type: 'agent', status: 'starting', objective, timestamp: new Date().toISOString() });

      const result = await runObjective(objective, {
        verbose: verbose ?? false,
        maxIterations: maxIterations ?? 50,
        maxToolCalls: maxToolCalls ?? 100,
      });

      broadcast({ type: 'agent', status: 'completed', result, timestamp: new Date().toISOString() });

      res.json({ success: true, result });
    } catch (error: any) {
      broadcast({ type: 'error', message: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent/chat
   * Send a message in chat mode
   */
  router.post('/agent/chat', async (req, res) => {
    try {
      const { sessionId, message } = req.body;

      if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      const sid = sessionId || `session-${Date.now()}`;
      
      // Get or create session
      let session = chatSessions.get(sid);
      if (!session) {
        session = {
          messages: [],
          ctx: {
            runId: sid,
            objective: { text: 'Interactive chat' },
            createdAt: Date.now(),
          },
        };
        chatSessions.set(sid, session);
      }

      // Add user message
      session.messages.push({ role: 'user', content: message });

      // Get response
      const agent = createAgentLoop();
      const response = await agent.chat(session.ctx, session.messages);
      
      // Add assistant message
      session.messages.push(response.message);

      broadcast({ 
        type: 'chat', 
        sessionId: sid, 
        message: response.message,
        timestamp: new Date().toISOString() 
      });

      res.json({ 
        success: true, 
        sessionId: sid,
        response: response.message,
        hasToolCalls: !!response.message.tool_calls?.length,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent/plan
   * Generate a plan for an objective
   */
  router.post('/agent/plan', async (req, res) => {
    try {
      const { objective } = req.body;

      if (!objective) {
        return res.status(400).json({ success: false, error: 'Objective is required' });
      }

      const plan = await generatePlan(objective);
      res.json({ success: true, plan });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agent/status
   * Get agent system status
   */
  router.get('/agent/status', async (req, res) => {
    try {
      const { createRouterFromEnv } = await import('../ai/router.js');
      const router = createRouterFromEnv();
      const providers = router.getAvailableProviders();
      const store = getMemoryStore();
      const memoryStats = await store.stats();

      res.json({
        success: true,
        status: {
          providers,
          memory: memoryStats,
          activeSessions: chatSessions.size,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ LEGACY RUNNER ENDPOINTS ============

  router.post('/runner/start', async (req, res) => {
    try {
      broadcast({ type: 'runner', status: 'starting', timestamp: new Date().toISOString() });
      await startDemoE2E();
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

  // ============ AUDIT ENDPOINTS ============

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

  // ============ VAULT ENDPOINTS ============

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

  // ============ MEMORY ENDPOINTS ============

  router.get('/memory', async (req, res) => {
    try {
      const store = getMemoryStore();
      const keys = await store.list();
      const stats = await store.stats();
      res.json({ success: true, keys, stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/memory/:key', async (req, res) => {
    try {
      const store = getMemoryStore();
      const entry = await store.retrieve(req.params.key);
      if (!entry) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      res.json({ success: true, entry });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/memory', async (req, res) => {
    try {
      const { key, value, tags } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ success: false, error: 'Key and value are required' });
      }
      const store = getMemoryStore();
      await store.store(key, value, tags);
      res.json({ success: true, stored: key });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/memory/search', async (req, res) => {
    try {
      const { query, tags, limit } = req.body;
      if (!query) {
        return res.status(400).json({ success: false, error: 'Query is required' });
      }
      const store = getMemoryStore();
      const results = await store.search(query, { tags, limit });
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/memory/:key', async (req, res) => {
    try {
      const store = getMemoryStore();
      const deleted = await store.delete(req.params.key);
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
