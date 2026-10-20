import { ok } from '../../lib/httpResponse';
import { logger } from '../../lib/logger';
import { getUserId } from '../../lib/identity';
import { generarUrlSubida } from '../../lib/s3-upload';
import { construirKeyImport } from '../../lib/import-key';
import { ValidationError } from '../../lib/validate';
import { withMiddleware } from '../../lib/middleware';

const EXPIRA_SEG = 300; // 5 minutos

export const handler = withMiddleware(async (event) => {
  const userId = getUserId(event);
  const filename = (event.queryStringParameters?.filename ?? '').trim();
  if (!filename) throw new ValidationError('Falta el parametro filename');
  if (!/\.csv$/i.test(filename)) throw new ValidationError('El archivo debe terminar en .csv');

  const key = construirKeyImport(userId, filename);
  const uploadUrl = await generarUrlSubida(key, EXPIRA_SEG);

  logger.info({ operation: 'import_upload_url_created' });
  return ok({ uploadUrl, key, expiraEn: EXPIRA_SEG });
});
