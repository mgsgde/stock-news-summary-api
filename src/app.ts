// Express app: logging, Swagger docs, generated routes and the error handler.
// index.ts calls listen(). The API tests use the returned app and do not open a port.

import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { ValidateError } from '@tsoa/runtime';
import { setReportService } from './controllers/ReportController';
import { HttpError } from './errors';
import { RegisterRoutes } from './generated/routes';
import type { ReportService } from './services/ReportService';
import swaggerDocument from './generated/swagger.json';

export function createApp(reportService: ReportService): express.Express {
  setReportService(reportService);

  const app = express();
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/', (_req, res) => {
    res.redirect('/docs');
  });
  // Agents and code generators read the spec here. Swagger UI is the same document for humans.
  app.get('/openapi.json', (_req, res) => {
    res.json(swaggerDocument);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  RegisterRoutes(app);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: 'Not found' });
  });

  // tsoa validation is 400. HttpError keeps its status. Other 4xx errors keep theirs. Anything else is 500, with the details only in the log.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ValidateError) {
      res.status(400).json({ message: 'Validation failed', details: error.fields });
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    // Express and body-parser errors (for example a URIError for a bad %-escape) carry a 4xx status.
    const status = (error as { status?: unknown } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status <= 499) {
      const message = error instanceof Error ? error.message : 'Bad request';
      res.status(status).json({ message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
}
