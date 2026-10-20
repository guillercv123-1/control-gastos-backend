import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  GetObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { leerObjeto } from './s3';

const s3Mock = mockClient(S3Client);
const crearBodySimulado = (
  contenido: string,
): NonNullable<GetObjectCommandOutput['Body']> =>
  ({
    transformToString: async () => contenido,
  }) as unknown as NonNullable<GetObjectCommandOutput['Body']>;

describe('leerObjeto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    s3Mock.reset();
  });

  it('debe leer el objeto solicitado y devolver su contenido como texto', async () => {
    // Arrange
    const bucket = 'bucket-pruebas';
    const key = 'imports/usuario-1/gastos.csv';
    const contenido = 'fecha,monto\n2025-02-28,12';
    s3Mock.on(GetObjectCommand).resolves({
      Body: crearBodySimulado(contenido),
    });

    // Act
    const resultado = await leerObjeto(bucket, key);

    // Assert
    expect(resultado).toBe(contenido);
    const llamada = s3Mock.commandCalls(GetObjectCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({ Bucket: bucket, Key: key });
  });

  it('debe devolver texto vacío cuando el objeto no tiene contenido', async () => {
    // Arrange
    s3Mock.on(GetObjectCommand).resolves({
      Body: crearBodySimulado(''),
    });

    // Act
    const resultado = await leerObjeto('bucket-pruebas', 'archivo-vacio.csv');

    // Assert
    expect(resultado).toBe('');
  });

  it('debe propagar el error inesperado de S3', async () => {
    // Arrange
    const error = new Error('Fallo de S3');
    s3Mock.on(GetObjectCommand).rejects(error);

    // Act
    const operacion = leerObjeto('bucket-pruebas', 'archivo.csv');

    // Assert
    await expect(operacion).rejects.toBe(error);
  });
});
