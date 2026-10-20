import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { leerObjeto } from '../lib/s3';
import { type GastoItem } from '../domain/gasto';
import { gastoRepository } from '../repositories/gasto-repository';
import { ImportacionService } from './importacion-service';

jest.mock('../lib/s3', () => ({
  leerObjeto: jest.fn<(bucket: string, key: string) => Promise<string>>(),
}));

jest.mock('../repositories/gasto-repository', () => ({
  gastoRepository: {
    putLote: jest.fn<(items: GastoItem[]) => Promise<void>>(),
  },
}));

jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const leerObjetoMock = jest.mocked(leerObjeto);
const putLoteMock = jest.mocked(gastoRepository.putLote);

describe('ImportacionService', () => {
  let servicio: ImportacionService;

  beforeEach(() => {
    jest.clearAllMocks();
    servicio = new ImportacionService();
    leerObjetoMock.mockReset();
    putLoteMock.mockReset();
    jest.mocked(logger.info).mockReset();
    jest.mocked(logger.warn).mockReset();
    jest.mocked(logger.error).mockReset();
  });

  it('debe leer, persistir y registrar el resultado de una importación correcta', async () => {
    // Arrange
    leerObjetoMock.mockResolvedValue('fecha,monto\n2025-02-20,12');
    putLoteMock.mockResolvedValue(undefined);

    // Act
    await servicio.procesarArchivo('bucket-pruebas', 'imports/usuario-1/gastos.csv');

    // Assert
    expect(putLoteMock).toHaveBeenCalledTimes(1);
    expect(putLoteMock.mock.calls[0]?.[0]).toHaveLength(1);
    expect(jest.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'import_success',
        count: 1,
        sourceType: 'csv',
      }),
    );
  });

  it('debe persistir filas válidas y aceptar parcialmente las inválidas', async () => {
    // Arrange
    leerObjetoMock.mockResolvedValue(
      'fecha,monto\n2025-02-20,12\nfecha-invalida,valor-invalido',
    );
    putLoteMock.mockResolvedValue(undefined);

    // Act
    await servicio.procesarArchivo('bucket-pruebas', 'imports/usuario-1/gastos.csv');

    // Assert
    expect(putLoteMock.mock.calls[0]?.[0]).toHaveLength(1);
    expect(jest.mocked(logger.warn)).toHaveBeenCalledWith({
      operation: 'import_partial_csv',
      errorCode: 'IMPORT_CSV_INVALID',
      retryable: false,
      count: 1,
      sourceType: 'csv',
    });
    expect(jest.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'import_partial_success', count: 1 }),
    );
  });

  it('debe rechazar una key que no identifica el formato de importación', async () => {
    // Arrange
    const keyInvalida = 'archivo.csv';

    // Act
    const operacion = servicio.procesarArchivo('bucket-pruebas', keyInvalida);

    // Assert
    await expect(operacion).rejects.toMatchObject({
      errorCode: 'IMPORT_INVALID_EVENT',
      retryable: true,
    });
    expect(leerObjetoMock).not.toHaveBeenCalled();
  });

  it('debe tratar un archivo sin filas válidas como CSV inválido', async () => {
    // Arrange
    leerObjetoMock.mockResolvedValue('fecha,monto\nfecha-invalida,12');

    // Act
    const operacion = servicio.procesarArchivo(
      'bucket-pruebas',
      'imports/usuario-1/gastos.csv',
    );

    // Assert
    await expect(operacion).rejects.toMatchObject({
      errorCode: 'IMPORT_CSV_INVALID',
      retryable: true,
    });
    expect(putLoteMock).not.toHaveBeenCalled();
  });

  it('debe tratar un archivo vacío como CSV inválido', async () => {
    // Arrange
    leerObjetoMock.mockResolvedValue('');

    // Act
    const operacion = servicio.procesarArchivo(
      'bucket-pruebas',
      'imports/usuario-1/gastos.csv',
    );

    // Assert
    await expect(operacion).rejects.toMatchObject({
      errorCode: 'IMPORT_CSV_INVALID',
    });
  });

  it('debe clasificar y propagar un fallo de lectura de S3', async () => {
    // Arrange
    leerObjetoMock.mockRejectedValue(new Error('fallo de prueba'));

    // Act
    const operacion = servicio.procesarArchivo(
      'bucket-pruebas',
      'imports/usuario-1/gastos.csv',
    );

    // Assert
    await expect(operacion).rejects.toBeInstanceOf(AppError);
    await expect(operacion).rejects.toMatchObject({
      errorCode: 'IMPORT_S3_READ_FAILED',
      retryable: true,
    });
    expect(jest.mocked(logger.error)).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'IMPORT_S3_READ_FAILED',
    }));
  });

  it('debe clasificar y propagar un fallo de persistencia', async () => {
    // Arrange
    leerObjetoMock.mockResolvedValue('fecha,monto\n2025-02-20,12');
    putLoteMock.mockRejectedValue(new Error('fallo de prueba'));

    // Act
    const operacion = servicio.procesarArchivo(
      'bucket-pruebas',
      'imports/usuario-1/gastos.csv',
    );

    // Assert
    await expect(operacion).rejects.toMatchObject({
      errorCode: 'IMPORT_DYNAMODB_WRITE_FAILED',
      retryable: true,
    });
  });

  it('debe conservar el error tipado de elementos DynamoDB no procesados', async () => {
    // Arrange
    leerObjetoMock.mockResolvedValue('fecha,monto\n2025-02-20,12');
    const error = new AppError('DYNAMODB_UNPROCESSED_ITEMS', true, 1);
    putLoteMock.mockRejectedValue(error);

    // Act
    const operacion = servicio.procesarArchivo(
      'bucket-pruebas',
      'imports/usuario-1/gastos.csv',
    );

    // Assert
    await expect(operacion).rejects.toBe(error);
    expect(jest.mocked(logger.error)).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'DYNAMODB_UNPROCESSED_ITEMS',
      count: 1,
    }));
  });
});
