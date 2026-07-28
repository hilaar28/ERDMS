import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ingestionRouter from './routes/ingestion.js';
import documentRouter from './routes/documents.js';
import { initIngestionSchema } from './models/ingestion.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration.
// `origin: '*'` combined with `credentials: true` is both invalid (browsers
// reject that combination) and, if it did work, a CSRF-prone pattern since
// it would let any site make authenticated requests on a user's behalf.
// No route here actually relies on cookies/credentials, so credentials are
// left off; the allowed origin is configurable via env for real deployments
// and falls back to the Vite dev server origin for local development.
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/ingestion', ingestionRouter);
app.use('/api/documents', documentRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize schema, then start listening. Starting the server before the
// schema exists could let requests hit routes that query tables that
// haven't been created yet.
initIngestionSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ERDMS Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database schema, exiting:', err);
    process.exit(1);
  });
