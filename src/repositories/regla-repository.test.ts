import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { reglaKey, type ReglaItem } from '../domain/regla';
import { ReglaRepository } from './regla-repository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const tableName = 'tabla-pruebas';

const crearRegla = (id: string): ReglaItem => ({
  ...reglaKey('usuario-1', id),
  id,
  userId: 'usuario-1',
  keyword: 'mercado',
  categoria: 'comida',
  createdAt: '2025-02-28T10:00:00.000Z',
});

const crearRepositorioConClienteInyectado = (): ReglaRepository => {
  const cliente = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return new ReglaRepository(cliente, tableName);
};

describe('ReglaRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ddbMock.reset();
  });

  it('debe guardar la regla en la tabla configurada', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const regla = crearRegla('regla-1');
    ddbMock.on(PutCommand).resolves({});

    // Act
    await repositorio.put(regla);

    // Assert
    const llamada = ddbMock.commandCalls(PutCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TableName: tableName,
      Item: regla,
    });
  });

  it('debe listar reglas por las claves de usuario y prefijo', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const reglas = [crearRegla('regla-1')];
    ddbMock.on(QueryCommand).resolves({ Items: reglas });

    // Act
    const resultado = await repositorio.listar('usuario-1');

    // Assert
    expect(resultado).toEqual(reglas);
    const llamada = ddbMock.commandCalls(QueryCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'USER#usuario-1',
        ':sk': 'REGLA#',
      },
    });
  });

  it('debe devolver una lista vacía cuando no hay reglas', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    ddbMock.on(QueryCommand).resolves({});

    // Act
    const resultado = await repositorio.listar('usuario-1');

    // Assert
    expect(resultado).toEqual([]);
  });

  it('debe eliminar una regla usando sus claves primarias', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    ddbMock.on(DeleteCommand).resolves({ Attributes: crearRegla('regla-1') });

    // Act
    const resultado = await repositorio.delete('usuario-1', 'regla-1');

    // Assert
    expect(resultado).toBe(true);
    const llamada = ddbMock.commandCalls(DeleteCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TableName: tableName,
      Key: { PK: 'USER#usuario-1', SK: 'REGLA#regla-1' },
      ReturnValues: 'ALL_OLD',
    });
  });

  it('debe devolver false si DynamoDB no devuelve atributos al eliminar', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    ddbMock.on(DeleteCommand).resolves({});

    // Act
    const resultado = await repositorio.delete('usuario-1', 'inexistente');

    // Assert
    expect(resultado).toBe(false);
  });

  it('debe propagar errores inesperados de DynamoDB', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const error = new Error('Fallo de DynamoDB');
    ddbMock.on(QueryCommand).rejects(error);

    // Act
    const operacion = repositorio.listar('usuario-1');

    // Assert
    await expect(operacion).rejects.toBe(error);
  });
});
