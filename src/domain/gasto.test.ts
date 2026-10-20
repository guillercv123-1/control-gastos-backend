import { describe, expect, it } from '@jest/globals';
import {
  buildKeys,
  itemKey,
  nuevoGastoItem,
  toGasto,
  UMBRAL_HORMIGA,
  type CrearGastoInput,
} from './gasto';

describe('claves de gasto', () => {
  it('debe construir las claves principales del usuario y el gasto', () => {
    // Arrange
    const userId = 'usuario-1';
    const gastoId = 'gasto-1';

    // Act
    const claves = itemKey(userId, gastoId);

    // Assert
    expect(claves).toEqual({
      PK: 'USER#usuario-1',
      SK: 'GASTO#gasto-1',
    });
  });

  it('debe construir las claves mensuales del índice secundario', () => {
    // Arrange
    const userId = 'usuario-1';
    const gastoId = 'gasto-1';
    const fecha = '2025-02-28';

    // Act
    const claves = buildKeys(userId, gastoId, fecha);

    // Assert
    expect(claves).toEqual({
      PK: 'USER#usuario-1',
      SK: 'GASTO#gasto-1',
      GSI1PK: 'USER#usuario-1#2025-02',
      GSI1SK: '2025-02-28#gasto-1',
    });
  });
});

describe('nuevoGastoItem', () => {
  const crearInput = (monto: number): CrearGastoInput => ({
    monto,
    categoria: 'comida',
    metodoPago: 'efectivo',
    fecha: '2025-02-28',
  });

  it('debe crear un gasto con claves, datos normalizados y fechas válidas', () => {
    // Arrange
    const userId = 'usuario-1';
    const input = crearInput(12);

    // Act
    const gasto = nuevoGastoItem(userId, input);

    // Assert
    expect(gasto).toMatchObject({
      ...buildKeys(userId, gasto.id, input.fecha),
      userId,
      monto: 12,
      categoria: 'comida',
      metodoPago: 'efectivo',
      fecha: '2025-02-28',
      comercio: null,
      descripcion: null,
      esHormiga: true,
      reciboKey: null,
    });
    expect(gasto.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(new Date(gasto.createdAt).toISOString()).toBe(gasto.createdAt);
    expect(gasto.updatedAt).toBe(gasto.createdAt);
  });

  it('debe considerar hormiga un gasto por debajo del umbral', () => {
    // Arrange
    const input = crearInput(UMBRAL_HORMIGA - 0.01);

    // Act
    const gasto = nuevoGastoItem('usuario-1', input);

    // Assert
    expect(gasto.esHormiga).toBe(true);
  });

  it('no debe considerar hormiga un gasto exactamente en el umbral', () => {
    // Arrange
    const input = crearInput(UMBRAL_HORMIGA);

    // Act
    const gasto = nuevoGastoItem('usuario-1', input);

    // Assert
    expect(gasto.esHormiga).toBe(false);
  });

  it('debe derivar las claves mensuales de la fecha recibida', () => {
    // Arrange
    const fecha = '2024-12-31';

    // Act
    const gasto = nuevoGastoItem('usuario-1', crearInput(1));
    const gastoConFecha = nuevoGastoItem('usuario-1', { ...crearInput(1), fecha });

    // Assert
    expect(gasto.fecha).toBe('2025-02-28');
    expect(gastoConFecha.GSI1PK).toBe('USER#usuario-1#2024-12');
    expect(gastoConFecha.GSI1SK).toBe(`${fecha}#${gastoConFecha.id}`);
  });

  it('debe convertir el item al modelo de gasto sin incluir sus claves', () => {
    // Arrange
    const item = nuevoGastoItem('usuario-1', crearInput(10));

    // Act
    const gasto = toGasto(item);

    // Assert
    expect(gasto).toEqual({
      id: item.id,
      userId: item.userId,
      monto: item.monto,
      categoria: item.categoria,
      metodoPago: item.metodoPago,
      fecha: item.fecha,
      comercio: item.comercio,
      descripcion: item.descripcion,
      esHormiga: item.esHormiga,
      reciboKey: item.reciboKey,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
    expect(gasto).not.toHaveProperty('PK');
    expect(gasto).not.toHaveProperty('GSI1PK');
  });
});
