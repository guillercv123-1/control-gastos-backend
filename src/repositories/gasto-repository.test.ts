import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { buildKeys, type GastoItem } from '../domain/gasto';
import {
  GastoRepository,
  UnprocessedItemsError,
} from './gasto-repository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const tableName = 'tabla-pruebas';

const crearGasto = (id: string, fecha = '2025-02-28'): GastoItem => ({
  ...buildKeys('usuario-1', id, fecha),
  id,
  userId: 'usuario-1',
  monto: 12,
  categoria: 'comida',
  metodoPago: 'efectivo',
  fecha,
  comercio: null,
  descripcion: null,
  esHormiga: true,
  reciboKey: null,
  createdAt: '2025-02-28T10:00:00.000Z',
  updatedAt: '2025-02-28T10:00:00.000Z',
});

const crearRepositorioConClienteInyectado = (): GastoRepository => {
  const cliente = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return new GastoRepository(cliente, tableName);
};

describe('GastoRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ddbMock.reset();
  });

  it('debe guardar el gasto en la tabla configurada', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const gasto = crearGasto('gasto-1');
    ddbMock.on(PutCommand).resolves({});

    // Act
    await repositorio.put(gasto);

    // Assert
    const llamada = ddbMock.commandCalls(PutCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TableName: tableName,
      Item: gasto,
    });
  });

  it('debe obtener un gasto por sus claves primarias', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const gasto = crearGasto('gasto-1');
    ddbMock.on(GetCommand).resolves({ Item: gasto });

    // Act
    const resultado = await repositorio.get('usuario-1', 'gasto-1');

    // Assert
    expect(resultado).toEqual(gasto);
    const llamada = ddbMock.commandCalls(GetCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TableName: tableName,
      Key: { PK: 'USER#usuario-1', SK: 'GASTO#gasto-1' },
    });
  });

  it('debe devolver null cuando el gasto no existe', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    ddbMock.on(GetCommand).resolves({});

    // Act
    const resultado = await repositorio.get('usuario-1', 'inexistente');

    // Assert
    expect(resultado).toBeNull();
  });

  it('debe eliminar un gasto mediante el cliente inyectado', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const gasto = crearGasto('gasto-1');
    ddbMock.on(DeleteCommand).resolves({ Attributes: gasto });

    // Act
    const resultado = await repositorio.delete('usuario-1', 'gasto-1');

    // Assert
    expect(resultado).toBe(true);
    const llamada = ddbMock.commandCalls(DeleteCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TableName: tableName,
      Key: { PK: 'USER#usuario-1', SK: 'GASTO#gasto-1' },
      ReturnValues: 'ALL_OLD',
    });
  });

  it('debe indicar que no eliminó nada cuando DynamoDB no devuelve atributos', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    ddbMock.on(DeleteCommand).resolves({});

    // Act
    const resultado = await repositorio.delete('usuario-1', 'gasto-1');

    // Assert
    expect(resultado).toBe(false);
  });

  it('debe listar por usuario usando las claves principales y filtrar resultados', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const gastos = [
      crearGasto('gasto-1'),
      { ...crearGasto('gasto-2'), categoria: 'transporte' },
    ];
    ddbMock.on(QueryCommand).resolves({ Items: gastos });

    // Act
    const resultado = await repositorio.listar('usuario-1', {
      categoria: 'comida',
    });

    // Assert
    expect(resultado).toEqual([gastos[0]]);
    const llamada = ddbMock.commandCalls(QueryCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'USER#usuario-1',
        ':sk': 'GASTO#',
      },
      ScanIndexForward: false,
    });
  });

  it('debe listar gastos del mes mediante GSI1 usando el cliente inyectado', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const gastos = [crearGasto('gasto-1')];
    ddbMock.on(QueryCommand).resolves({ Items: gastos });

    // Act
    const resultado = await repositorio.listar('usuario-1', {
      mes: '2025-02',
    });

    // Assert
    expect(resultado).toEqual(gastos);
    const llamada = ddbMock.commandCalls(QueryCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TableName: tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'USER#usuario-1#2025-02' },
      ScanIndexForward: false,
    });
  });

  it('debe devolver una lista vacía cuando la consulta no encuentra resultados', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    ddbMock.on(QueryCommand).resolves({});

    // Act
    const resultado = await repositorio.listar('usuario-1', { mes: '2025-02' });

    // Assert
    expect(resultado).toEqual([]);
  });

  it('debe propagar los errores inesperados de DynamoDB', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const error = new Error('Fallo de DynamoDB');
    ddbMock.on(QueryCommand).rejects(error);

    // Act
    const operacion = repositorio.listar('usuario-1');

    // Assert
    await expect(operacion).rejects.toBe(error);
  });

  it('debe actualizar el gasto y reconstruir las claves al cambiar la fecha', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const gasto = crearGasto('gasto-1');
    ddbMock.on(GetCommand).resolves({ Item: gasto });
    ddbMock.on(PutCommand).resolves({});

    // Act
    const resultado = await repositorio.update('usuario-1', 'gasto-1', {
      fecha: '2025-03-01',
      monto: 25,
    });

    // Assert
    expect(resultado).toMatchObject({
      ...buildKeys('usuario-1', 'gasto-1', '2025-03-01'),
      monto: 25,
      esHormiga: false,
    });
    const llamada = ddbMock.commandCalls(PutCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input.TableName).toBe(tableName);
  });

  it('debe devolver null y no guardar cuando se intenta actualizar un gasto inexistente', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    ddbMock.on(GetCommand).resolves({});

    // Act
    const resultado = await repositorio.update('usuario-1', 'inexistente', {
      monto: 25,
    });

    // Assert
    expect(resultado).toBeNull();
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('debe escanear gastos y continuar desde la última clave evaluada', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const primeraClave = { PK: 'USER#usuario-1', SK: 'GASTO#1' };
    const primerGasto = crearGasto('gasto-1');
    const segundoGasto = crearGasto('gasto-2');
    ddbMock.on(ScanCommand)
      .resolvesOnce({ Items: [primerGasto], LastEvaluatedKey: primeraClave })
      .resolvesOnce({ Items: [segundoGasto] });

    // Act
    const resultado = await repositorio.escanearGastos();

    // Assert
    expect(resultado).toEqual([primerGasto, segundoGasto]);
    const llamadas = ddbMock.commandCalls(ScanCommand);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0]?.args[0].input).toEqual({
      TableName: tableName,
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':sk': 'GASTO#' },
    });
    expect(llamadas[1]?.args[0].input).toEqual({
      TableName: tableName,
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':sk': 'GASTO#' },
      ExclusiveStartKey: primeraClave,
    });
  });

  it('debe guardar lotes en comandos BatchWrite', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const gastos = [crearGasto('gasto-1'), crearGasto('gasto-2')];
    ddbMock.on(BatchWriteCommand).resolves({});

    // Act
    await repositorio.putLote(gastos);

    // Assert
    const llamada = ddbMock.commandCalls(BatchWriteCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      RequestItems: {
        [tableName]: gastos.map((Item) => ({ PutRequest: { Item } })),
      },
    });
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(1);
  });

  it('debe reintentar los elementos no procesados y completar el lote', async () => {
    // Arrange
    const esperas: number[] = [];
    const repositorio = new GastoRepository(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      tableName,
      async (durationMs) => {
        esperas.push(durationMs);
      },
    );
    const gasto = crearGasto('gasto-1');
    const solicitudNoProcesada = { PutRequest: { Item: gasto } };
    ddbMock.on(BatchWriteCommand)
      .resolvesOnce({ UnprocessedItems: { [tableName]: [solicitudNoProcesada] } })
      .resolvesOnce({});

    // Act
    await repositorio.putLote([gasto]);

    // Assert
    const llamadas = ddbMock.commandCalls(BatchWriteCommand);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[1]?.args[0].input.RequestItems?.[tableName]).toEqual([
      solicitudNoProcesada,
    ]);
    expect(esperas).toEqual([25]);
  });

  it('debe lanzar error tipado cuando expira el máximo de reintentos del lote', async () => {
    // Arrange
    const esperas: number[] = [];
    const repositorio = new GastoRepository(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      tableName,
      async (durationMs) => {
        esperas.push(durationMs);
      },
    );
    const gasto = crearGasto('gasto-1');
    ddbMock.on(BatchWriteCommand).resolves({
      UnprocessedItems: {
        [tableName]: [{ PutRequest: { Item: gasto } }],
      },
    });

    // Act
    const operacion = repositorio.putLote([gasto]);

    // Assert
    await expect(operacion).rejects.toBeInstanceOf(UnprocessedItemsError);
    await expect(operacion).rejects.toMatchObject({
      errorCode: 'DYNAMODB_UNPROCESSED_ITEMS',
      retryable: true,
      count: 1,
    });
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(4);
    expect(esperas).toEqual([25, 50, 100]);
  });

  it('debe propagar errores inesperados de BatchWrite', async () => {
    // Arrange
    const repositorio = crearRepositorioConClienteInyectado();
    const error = new Error('Fallo de DynamoDB');
    ddbMock.on(BatchWriteCommand).rejects(error);

    // Act
    const operacion = repositorio.putLote([crearGasto('gasto-1')]);

    // Assert
    await expect(operacion).rejects.toBe(error);
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(1);
  });
});
