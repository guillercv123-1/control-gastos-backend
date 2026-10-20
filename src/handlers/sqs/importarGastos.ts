import type {
  SQSEvent,
  SQSBatchResponse,
  SQSRecord,
} from 'aws-lambda';
import type { ErrorCode } from '../../lib/errors';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { importacionService } from '../../services/importacion-service';

interface ObjetoS3 {
  bucket: string;
  key: string;
}

export const handler = async (
  event: SQSEvent,
): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      await procesarMensaje(record);
    } catch (error) {
      batchItemFailures.push({ itemIdentifier: record.messageId });
      logger.error({
        operation: 'sqs_import_message',
        errorCode: obtenerCodigo(error),
        retryable: true,
        count: 1,
        sourceType: 'sqs',
      });
    }
  }

  return { batchItemFailures };
};

const procesarMensaje = async (record: SQSRecord): Promise<void> => {
  const objetos = extraerObjetosS3(record.body);
  let fallos = 0;
  let primerCodigo: ErrorCode | undefined;

  for (const objeto of objetos) {
    try {
      await importacionService.procesarArchivo(objeto.bucket, objeto.key);
    } catch (error) {
      fallos += 1;
      primerCodigo ??= obtenerCodigo(error);
    }
  }

  if (fallos > 0) {
    throw new AppError(primerCodigo ?? 'IMPORT_PROCESSING_FAILED', true);
  }
};

const extraerObjetosS3 = (body: string): ObjetoS3[] => {
  let evento: unknown;
  try {
    evento = JSON.parse(body) as unknown;
  } catch {
    throw new AppError('IMPORT_INVALID_EVENT', true);
  }

  if (!esObjeto(evento) || !Array.isArray(evento.Records) || evento.Records.length === 0) {
    throw new AppError('IMPORT_INVALID_EVENT', true);
  }

  return evento.Records.map((registro): ObjetoS3 => {
    if (!esObjeto(registro) || !esObjeto(registro.s3)) {
      throw new AppError('IMPORT_INVALID_EVENT', true);
    }
    const bucket = registro.s3.bucket;
    const objeto = registro.s3.object;
    if (
      !esObjeto(bucket) ||
      typeof bucket.name !== 'string' ||
      bucket.name.length === 0 ||
      !esObjeto(objeto) ||
      typeof objeto.key !== 'string' ||
      objeto.key.length === 0
    ) {
      throw new AppError('IMPORT_INVALID_EVENT', true);
    }

    try {
      return {
        bucket: bucket.name,
        key: decodeURIComponent(objeto.key.replace(/\+/g, ' ')),
      };
    } catch {
      throw new AppError('IMPORT_INVALID_EVENT', true);
    }
  });
};

const esObjeto = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const obtenerCodigo = (error: unknown): ErrorCode =>
  error instanceof AppError ? error.errorCode : 'IMPORT_PROCESSING_FAILED';
