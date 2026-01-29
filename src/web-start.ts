import { startWebServer } from './web/server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

startWebServer(PORT);
