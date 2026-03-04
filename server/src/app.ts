// server/src/app.ts — Express application factory
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): express.Express {
  const app = express();

  // CORS configuration
  const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGIN || true
      : '*',
    credentials: true,
  };

  app.use(cors(corsOptions));
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // In production, serve client build
  if (process.env.NODE_ENV === 'production') {
    const clientPath = path.join(__dirname, '../../client/dist');

    app.use(express.static(clientPath, {
      maxAge: '1d',
      etag: true,
      lastModified: true,
    }));

    // SPA fallback
    app.get('*', (_, res) => {
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  }

  return app;
}
