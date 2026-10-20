import type { ScheduledEvent } from 'aws-lambda';
import { logger } from '../../lib/logger';
import { mesAnterior } from '../../domain/periodo';
import { reporteMensualService } from '../../services/reporte-mensual-service';
import { withErrorLogging } from '../../lib/middleware';

export const handler = withErrorLogging(
  async (event: ScheduledEvent & { mes?: string }) => {
    const mes = event?.mes ?? mesAnterior(new Date());
    logger.info({ operation: 'monthly_report_started' });
    await reporteMensualService.generarYEnviar(mes);
  },
  'monthly_report',
  'REPORT_GENERATION_FAILED',
);
