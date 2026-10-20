import { parsearCsvGastos, extraerUserIdDeKey } from '../domain/csv';
import { nuevoGastoItem, type GastoItem } from '../domain/gasto';
import { gastoRepository } from '../repositories/gasto-repository';
import { leerObjeto } from '../lib/s3';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export class ImportacionService {
  async procesarArchivo(bucket: string, key: string): Promise<void> {
    const inicio = Date.now();
    const userId = extraerUserIdDeKey(key);
    if (!userId) {
      logger.error({
        operation: 'import_validate_object_key',
        errorCode: 'IMPORT_INVALID_EVENT',
        retryable: true,
        count: 1,
        sourceType: 's3',
      });
      throw new AppError('IMPORT_INVALID_EVENT', true);
    }

    let texto: string;
    try {
      texto = await leerObjeto(bucket, key);
    } catch {
      logger.error({
        operation: 'import_read_s3_object',
        errorCode: 'IMPORT_S3_READ_FAILED',
        retryable: true,
        count: 1,
        sourceType: 's3',
      });
      throw new AppError('IMPORT_S3_READ_FAILED', true);
    }

    const { filas, errores } = parsearCsvGastos(texto);
    if (filas.length === 0) {
      logger.error({
        operation: 'import_parse_csv',
        errorCode: 'IMPORT_CSV_INVALID',
        retryable: true,
        count: Math.max(errores.length, 1),
        sourceType: 'csv',
      });
      throw new AppError('IMPORT_CSV_INVALID', true);
    }

    if (errores.length > 0) {
      logger.warn({
        operation: 'import_partial_csv',
        errorCode: 'IMPORT_CSV_INVALID',
        retryable: false,
        count: errores.length,
        sourceType: 'csv',
      });
    }

    const items: GastoItem[] = filas.map((fila) => nuevoGastoItem(userId, fila));
    try {
      await gastoRepository.putLote(items);
    } catch (error) {
      const errorLoteParcial = error instanceof AppError &&
        error.errorCode === 'DYNAMODB_UNPROCESSED_ITEMS'
        ? error
        : undefined;
      logger.error({
        operation: 'import_persist_gastos',
        errorCode: errorLoteParcial
          ? 'DYNAMODB_UNPROCESSED_ITEMS'
          : 'IMPORT_DYNAMODB_WRITE_FAILED',
        retryable: true,
        count: errorLoteParcial?.count ?? items.length,
        sourceType: 'dynamodb',
      });
      if (errorLoteParcial) throw error;
      throw new AppError('IMPORT_DYNAMODB_WRITE_FAILED', true);
    }

    logger.info({
      operation: errores.length > 0 ? 'import_partial_success' : 'import_success',
      count: filas.length,
      durationMs: Date.now() - inicio,
      sourceType: 'csv',
    });
  }
}

export const importacionService = new ImportacionService();
