import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { logger } from './logger';

describe('logger seguro', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe emitir únicamente contexto operativo permitido', () => {
    // Arrange
    const escribir = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    logger.error({
      operation: 'import_read_s3_object',
      errorCode: 'IMPORT_S3_READ_FAILED',
      retryable: true,
      count: 1,
      durationMs: 25,
      sourceType: 's3',
    });

    // Assert
    expect(escribir).toHaveBeenCalledTimes(1);
    const entrada = escribir.mock.calls[0]?.[0];
    expect(typeof entrada).toBe('string');
    if (typeof entrada !== 'string') {
      throw new Error('El logger debe emitir una entrada JSON serializada');
    }
    expect(JSON.parse(entrada) as Record<string, unknown>).toMatchObject({
      operation: 'import_read_s3_object',
      errorCode: 'IMPORT_S3_READ_FAILED',
      retryable: true,
      count: 1,
      durationMs: 25,
      sourceType: 's3',
      service: expect.any(String),
      stage: expect.any(String),
    });
    expect(Object.keys(JSON.parse(entrada) as Record<string, unknown>).sort()).toEqual([
      'count',
      'durationMs',
      'errorCode',
      'operation',
      'retryable',
      'service',
      'sourceType',
      'stage',
    ]);
  });
});
