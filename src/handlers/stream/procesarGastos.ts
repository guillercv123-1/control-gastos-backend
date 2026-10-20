import type {
  DynamoDBBatchResponse,
  DynamoDBRecord,
  DynamoDBStreamEvent,
} from 'aws-lambda';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { Gasto } from '../../domain/gasto';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { alertaHormigaService } from '../../services/alerta-service';

export const handler = async (
  event: DynamoDBStreamEvent,
): Promise<DynamoDBBatchResponse> => {
  const batchItemFailures: DynamoDBBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    if (!esGastoNuevo(record)) continue;

    try {
      await procesarRegistro(record);
    } catch {
      const sequenceNumber = record.dynamodb?.SequenceNumber;
      if (!sequenceNumber) {
        logger.error({
          operation: 'stream_record_processing',
          errorCode: 'STREAM_RECORD_PROCESSING_FAILED',
          retryable: true,
          count: 1,
          sourceType: 'dynamodb_stream',
        });
        throw new AppError('STREAM_RECORD_PROCESSING_FAILED', true);
      }

      batchItemFailures.push({ itemIdentifier: sequenceNumber });
      logger.error({
        operation: 'stream_record_processing',
        errorCode: 'STREAM_RECORD_PROCESSING_FAILED',
        retryable: true,
        count: 1,
        sourceType: 'dynamodb_stream',
      });
    }
  }

  return { batchItemFailures };
};

const procesarRegistro = async (record: DynamoDBRecord): Promise<void> => {
  const image = record.dynamodb?.NewImage;
  if (!image) {
    throw new AppError('STREAM_RECORD_PROCESSING_FAILED', true);
  }

  const item = unmarshall(image as unknown as Record<string, AttributeValue>);
  if (!esGasto(item)) {
    throw new AppError('STREAM_RECORD_PROCESSING_FAILED', true);
  }

  await alertaHormigaService.evaluarGasto(item);
};

const esGastoNuevo = (record: DynamoDBRecord): boolean => {
  if (record.eventName !== 'INSERT') return false;
  const sk = record.dynamodb?.Keys?.SK?.S;
  return typeof sk === 'string' && sk.startsWith('GASTO#');
};

const esGasto = (value: unknown): value is Gasto => {
  if (typeof value !== 'object' || value === null) return false;
  const gasto = value as Record<string, unknown>;
  return typeof gasto.id === 'string' &&
    typeof gasto.userId === 'string' &&
    typeof gasto.monto === 'number' &&
    typeof gasto.categoria === 'string' &&
    typeof gasto.metodoPago === 'string' &&
    typeof gasto.fecha === 'string' &&
    (typeof gasto.comercio === 'string' || gasto.comercio === null) &&
    (typeof gasto.descripcion === 'string' || gasto.descripcion === null) &&
    typeof gasto.esHormiga === 'boolean' &&
    (typeof gasto.reciboKey === 'string' || gasto.reciboKey === null) &&
    typeof gasto.createdAt === 'string' &&
    typeof gasto.updatedAt === 'string';
};
