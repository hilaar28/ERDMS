import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ingestionRouter from './routes/ingestion.js';
import documentRouter from './routes/documents.js';
import { initIngestionSchema } from './models/ingestion.js';
import { initializeIndexTables } from './models/indexing.js';
import { initializeAuthTables, initializeCmsTables } from './models/rbac.js';
import { initializeVersioningTables } from './models/versions.js';
import { initializeRetentionTables } from './models/retention.js';
import { initializeImmutableAudit } from './models/auditTrail.js';
import { initializeTaskTables } from './models/tasks.js';
import { initClassificationSchema } from './models/classification.js';
import { initializeJwtSecret } from './middleware/auth.js';
import { generalRateLimiter } from './middleware/rateLimit.js';
import indexRouter from './routes/index.js';
import authRouter from './routes/auth.js';
import cmsRouter from './routes/cms-gateway.js';
import versionsRouter from './routes/versions.js';
import retentionRouter from './routes/retention.js';
import auditTrailRouter from './routes/auditTrail.js';
import tasksRouter from './routes/tasks.js';
import classificationRouter from './routes/classification.js';

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

// General rate limiting — protects all routes from abuse
app.use(generalRateLimiter);

// Routes
app.use('/api/ingestion', ingestionRouter);
app.use('/api/documents', documentRouter);
app.use('/api/index', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/cms', cmsRouter);
app.use('/api/versioning', versionsRouter);
app.use('/api/retention', retentionRouter);
app.use('/api/audit', auditTrailRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/classification', classificationRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize schema, then start listening. Starting the server before the
// schema exists could let requests hit routes that query tables that
// haven't been created yet.
initClassificationSchema()
  .then(async () => {
    await initIngestionSchema();
    await initializeIndexTables();
    await initializeAuthTables();
    await initializeCmsTables();
    await initializeVersioningTables();
    await initializeRetentionTables();
    await initializeImmutableAudit();
    await initializeTaskTables();
    await initializeJwtSecret();
    app.listen(PORT, () => {
      console.log(`ERDMS Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize server, exiting:', err);
    process.exit(1);
  });
