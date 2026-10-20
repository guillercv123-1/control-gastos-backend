import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generarUrlSubida } from './s3-upload';
import { config } from '../config/env';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const getSignedUrlMock = jest.mocked(getSignedUrl);

describe('generarUrlSubida', () => {
  const bucketOriginal = config.importBucket;

  beforeEach(() => {
    jest.clearAllMocks();
    config.importBucket = 'bucket-pruebas';
    getSignedUrlMock.mockResolvedValue('https://s3.local/url-firmada');
  });

  afterEach(() => {
    config.importBucket = bucketOriginal;
  });

  it('debe firmar el comando PUT con el bucket, la key y la expiración predeterminada', async () => {
    // Arrange
    const key = 'imports/usuario-1/gastos.csv';

    // Act
    const resultado = await generarUrlSubida(key);

    // Assert
    expect(resultado).toBe('https://s3.local/url-firmada');
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    const [cliente, comando, opciones] = getSignedUrlMock.mock.calls[0] ?? [];
    expect(cliente).toBeInstanceOf(S3Client);
    expect(comando).toBeInstanceOf(PutObjectCommand);
    if (!(comando instanceof PutObjectCommand)) {
      throw new Error('Se esperaba un comando PutObjectCommand');
    }
    expect(comando.input).toEqual({ Bucket: 'bucket-pruebas', Key: key });
    expect(opciones).toEqual({ expiresIn: 300 });
  });

  it('debe utilizar la expiración indicada por el llamador', async () => {
    // Arrange
    const key = 'imports/usuario-1/gastos.csv';
    const expiracion = 120;

    // Act
    await generarUrlSubida(key, expiracion);

    // Assert
    const llamada = getSignedUrlMock.mock.calls[0];
    expect(llamada).toBeDefined();
    expect(llamada?.[1]).toBeInstanceOf(PutObjectCommand);
    expect(llamada?.[2]).toEqual({ expiresIn: expiracion });
  });

  it('debe utilizar el bucket vacío cuando IMPORT_BUCKET no está definida', async () => {
    // Arrange
    const valorOriginal = process.env.IMPORT_BUCKET;
    delete process.env.IMPORT_BUCKET;

    try {
      await jest.isolateModulesAsync(async () => {
        const presigner = await import('@aws-sdk/s3-request-presigner');
        const { generarUrlSubida: generarUrlAislada } = await import('./s3-upload');
        const firmarUrl = jest.mocked(presigner.getSignedUrl);
        firmarUrl.mockResolvedValue('https://s3.local/url-firmada');

        // Act
        await generarUrlAislada('imports/usuario-1/gastos.csv');

        // Assert
        const llamada = firmarUrl.mock.calls[0];
        const comando = llamada?.[1];
        expect(comando).toHaveProperty('input', {
          Bucket: '',
          Key: 'imports/usuario-1/gastos.csv',
        });
      });
    } finally {
      if (valorOriginal === undefined) {
        delete process.env.IMPORT_BUCKET;
      } else {
        process.env.IMPORT_BUCKET = valorOriginal;
      }
    }
  });

  it('debe pasar sin validar un IMPORT_BUCKET con formato incorrecto', async () => {
    // Arrange
    const bucketInvalido = ' ';
    const valorOriginal = process.env.IMPORT_BUCKET;
    process.env.IMPORT_BUCKET = bucketInvalido;

    try {
      await jest.isolateModulesAsync(async () => {
        const presigner = await import('@aws-sdk/s3-request-presigner');
        const { generarUrlSubida: generarUrlAislada } = await import('./s3-upload');
        const firmarUrl = jest.mocked(presigner.getSignedUrl);
        firmarUrl.mockResolvedValue('https://s3.local/url-firmada');

        // Act
        await generarUrlAislada('imports/usuario-1/gastos.csv');

        // Assert
        const llamada = firmarUrl.mock.calls[0];
        const comando = llamada?.[1];
        expect(comando).toHaveProperty('input', {
          Bucket: bucketInvalido,
          Key: 'imports/usuario-1/gastos.csv',
        });
      });
    } finally {
      if (valorOriginal === undefined) {
        delete process.env.IMPORT_BUCKET;
      } else {
        process.env.IMPORT_BUCKET = valorOriginal;
      }
    }
  });

  it('debe propagar errores inesperados del generador de URL firmada', async () => {
    // Arrange
    const error = new Error('No se pudo firmar la URL');
    getSignedUrlMock.mockRejectedValue(error);

    // Act
    const operacion = generarUrlSubida('imports/usuario-1/gastos.csv');

    // Assert
    await expect(operacion).rejects.toBe(error);
  });
});
