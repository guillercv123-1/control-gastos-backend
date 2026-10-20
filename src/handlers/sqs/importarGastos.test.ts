import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { logger } from '../../lib/logger';
import { importacionService } from '../../services/importacion-service';
import { handler } from './importarGastos';

jest.mock('../../services/importacion-service', () => ({
  importacionService: {
    procesarArchivo: jest.fn<(bucket: string, key: string) => Promise<void>>(),
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const crearRegistroSqs = (messageId: string, body: string): SQSRecord => ({
  messageId,
  receiptHandle: 'receipt-handle',
  body,
  attributes: {
    ApproximateReceiveCount: '1',
    SentTimestamp: '0',
    SenderId: 'sender',
    ApproximateFirstReceiveTimestamp: '0',
  },
  messageAttributes: {},
  md5OfBody: 'md5',
  eventSource: 'aws:sqs',
  eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:queue',
  awsRegion: 'us-east-1',
});

const crearEventoS3 = (key = 'imports%2Fusuario-1%2Fgastos.csv'): string =>
  JSON.stringify({
    Records: [{
      s3: {
        bucket: { name: 'bucket-pruebas' },
        object: { key },
      },
    }],
  });

const procesarArchivoMock = jest.mocked(importacionService.procesarArchivo);

describe('handler de importación SQS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    procesarArchivoMock.mockReset();
    procesarArchivoMock.mockResolvedValue(undefined);
    jest.mocked(logger.error).mockReset();
  });

  it('debe procesar la notificación S3 y confirmar el mensaje SQS', async () => {
    // Arrange
    const evento: SQSEvent = {
      Records: [crearRegistroSqs('mensaje-1', crearEventoS3(
        'imports%2Fusuario-1%2Fgastos+del+mes.csv',
      ))],
    };

    // Act
    const respuesta = await handler(evento);

    // Assert
    expect(respuesta).toEqual({ batchItemFailures: [] });
    expect(procesarArchivoMock).toHaveBeenCalledWith(
      'bucket-pruebas',
      'imports/usuario-1/gastos del mes.csv',
    );
  });

  it('debe devolver como fallido el mensaje que contiene una entrada inválida', async () => {
    // Arrange
    const evento: SQSEvent = {
      Records: [crearRegistroSqs('mensaje-invalido', JSON.stringify({
        Records: [{ s3: { bucket: {}, object: { key: '' } } }],
      }))],
    };

    // Act
    const respuesta = await handler(evento);

    // Assert
    expect(respuesta).toEqual({
      batchItemFailures: [{ itemIdentifier: 'mensaje-invalido' }],
    });
    expect(procesarArchivoMock).not.toHaveBeenCalled();
    expect(jest.mocked(logger.error)).toHaveBeenCalledWith({
      operation: 'sqs_import_message',
      errorCode: 'IMPORT_INVALID_EVENT',
      retryable: true,
      count: 1,
      sourceType: 'sqs',
    });
  });

  it('debe devolver solo los identificadores de los mensajes con fallos', async () => {
    // Arrange
    procesarArchivoMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fallo de prueba'));
    const evento: SQSEvent = {
      Records: [
        crearRegistroSqs('mensaje-correcto', crearEventoS3()),
        crearRegistroSqs('mensaje-fallido', crearEventoS3()),
      ],
    };

    // Act
    const respuesta = await handler(evento);

    // Assert
    expect(respuesta).toEqual({
      batchItemFailures: [{ itemIdentifier: 'mensaje-fallido' }],
    });
    expect(procesarArchivoMock).toHaveBeenCalledTimes(2);
  });

  it('debe marcar el mensaje como fallido cuando el cuerpo no es JSON válido', async () => {
    // Arrange
    const evento: SQSEvent = {
      Records: [crearRegistroSqs('mensaje-malformado', '{')],
    };

    // Act
    const respuesta = await handler(evento);

    // Assert
    expect(respuesta.batchItemFailures).toEqual([
      { itemIdentifier: 'mensaje-malformado' },
    ]);
  });
});
