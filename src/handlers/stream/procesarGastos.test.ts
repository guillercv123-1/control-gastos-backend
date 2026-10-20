import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import type { Gasto } from '../../domain/gasto';
import { logger } from '../../lib/logger';
import { alertaHormigaService } from '../../services/alerta-service';
import { handler } from './procesarGastos';

jest.mock('../../services/alerta-service', () => ({
  alertaHormigaService: { evaluarGasto: jest.fn<(gasto: Gasto) => Promise<void>>() },
}));

jest.mock('../../lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const crearRegistro = (
  sequenceNumber: string,
  options: { eventName?: DynamoDBRecord['eventName']; sortKey?: string } = {},
): DynamoDBRecord => ({
  eventName: options.eventName ?? 'INSERT',
  dynamodb: {
    SequenceNumber: sequenceNumber,
    Keys: { SK: { S: options.sortKey ?? 'GASTO#gasto-1' } },
    NewImage: {
      id: { S: 'gasto-1' },
      userId: { S: 'usuario-1' },
      monto: { N: '10' },
      categoria: { S: 'comida' },
      metodoPago: { S: 'efectivo' },
      fecha: { S: '2025-02-20' },
      comercio: { NULL: true },
      descripcion: { NULL: true },
      esHormiga: { BOOL: true },
      reciboKey: { NULL: true },
      createdAt: { S: '2025-02-20T10:00:00.000Z' },
      updatedAt: { S: '2025-02-20T10:00:00.000Z' },
    },
  },
});

const crearEvento = (...records: DynamoDBRecord[]): DynamoDBStreamEvent => ({
  Records: records,
});

const evaluarGastoMock = jest.mocked(alertaHormigaService.evaluarGasto);

describe('handler de DynamoDB Streams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    evaluarGastoMock.mockReset();
    jest.mocked(logger.error).mockReset();
  });

  it('debe devolver una lista vacía de fallos cuando todo el batch se procesa', async () => {
    // Arrange
    evaluarGastoMock.mockResolvedValue(undefined);
    const evento = crearEvento(crearRegistro('100'));

    // Act
    const respuesta = await handler(evento);

    // Assert
    expect(respuesta).toEqual({ batchItemFailures: [] });
    expect(evaluarGastoMock).toHaveBeenCalledTimes(1);
  });

  it('debe devolver el identificador del registro fallido sin fallar el resto del batch', async () => {
    // Arrange
    evaluarGastoMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('error de prueba'));
    const evento = crearEvento(
      crearRegistro('101'),
      crearRegistro('102', { sortKey: 'GASTO#gasto-2' }),
    );

    // Act
    const respuesta = await handler(evento);

    // Assert
    expect(respuesta).toEqual({
      batchItemFailures: [{ itemIdentifier: '102' }],
    });
    expect(evaluarGastoMock).toHaveBeenCalledTimes(2);
    expect(jest.mocked(logger.error)).toHaveBeenCalledWith({
      operation: 'stream_record_processing',
      errorCode: 'STREAM_RECORD_PROCESSING_FAILED',
      retryable: true,
      count: 1,
      sourceType: 'dynamodb_stream',
    });
  });

  it('debe devolver los identificadores de todos los registros fallidos', async () => {
    // Arrange
    evaluarGastoMock.mockRejectedValue(new Error('error de prueba'));
    const evento = crearEvento(
      crearRegistro('201'),
      crearRegistro('202', { sortKey: 'GASTO#gasto-2' }),
    );

    // Act
    const respuesta = await handler(evento);

    // Assert
    expect(respuesta).toEqual({
      batchItemFailures: [
        { itemIdentifier: '201' },
        { itemIdentifier: '202' },
      ],
    });
  });

  it('debe ignorar registros que no correspondan a un gasto nuevo', async () => {
    // Arrange
    const evento = crearEvento(
      crearRegistro('301', { sortKey: 'REGLA#regla-1' }),
      crearRegistro('302', { eventName: 'MODIFY' }),
    );

    // Act
    const respuesta = await handler(evento);

    // Assert
    expect(respuesta).toEqual({ batchItemFailures: [] });
    expect(evaluarGastoMock).not.toHaveBeenCalled();
  });

  it('debe marcar como fallido un registro cuando el servicio arroja un error inesperado', async () => {
    // Arrange
    evaluarGastoMock.mockRejectedValue(new Error('error inesperado'));
    const evento = crearEvento(crearRegistro('401'));

    // Act
    const respuesta = await handler(evento);

    // Assert
    expect(respuesta.batchItemFailures).toEqual([{ itemIdentifier: '401' }]);
  });
});
