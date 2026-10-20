import { describe, expect, it } from '@jest/globals';
import {
  nuevaReglaItem,
  reglaKey,
  sugerirCategoria,
  toRegla,
  type Regla,
} from './regla';

describe('reglaKey', () => {
  it('debe construir las claves principales de una regla', () => {
    // Arrange
    const userId = 'usuario-1';
    const reglaId = 'regla-1';

    // Act
    const claves = reglaKey(userId, reglaId);

    // Assert
    expect(claves).toEqual({
      PK: 'USER#usuario-1',
      SK: 'REGLA#regla-1',
    });
  });
});

describe('nuevaReglaItem', () => {
  it('debe normalizar keyword y categoría, generar claves y registrar la fecha', () => {
    // Arrange
    const userId = 'usuario-1';

    // Act
    const regla = nuevaReglaItem(userId, {
      keyword: '  SUPER MERCADO  ',
      categoria: '  compras  ',
    });

    // Assert
    expect(regla).toMatchObject({
      ...reglaKey(userId, regla.id),
      userId,
      keyword: 'super mercado',
      categoria: 'compras',
    });
    expect(regla.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(new Date(regla.createdAt).toISOString()).toBe(regla.createdAt);
  });

  it('debe conservar keyword y categoría vacías después de normalizarlas', () => {
    // Arrange
    const userId = 'usuario-1';

    // Act
    const regla = nuevaReglaItem(userId, { keyword: '  ', categoria: '  ' });

    // Assert
    expect(regla.keyword).toBe('');
    expect(regla.categoria).toBe('');
  });

  it('debe convertir el item al modelo de regla sin incluir sus claves', () => {
    // Arrange
    const item = nuevaReglaItem('usuario-1', {
      keyword: 'mercado',
      categoria: 'comida',
    });

    // Act
    const regla = toRegla(item);

    // Assert
    expect(regla).toEqual({
      id: item.id,
      userId: item.userId,
      keyword: item.keyword,
      categoria: item.categoria,
      createdAt: item.createdAt,
    });
    expect(regla).not.toHaveProperty('PK');
    expect(regla).not.toHaveProperty('SK');
  });
});

describe('sugerirCategoria', () => {
  const reglas: Regla[] = [
    {
      id: 'regla-cafe',
      userId: 'usuario-1',
      keyword: 'cafe',
      categoria: 'bebidas',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'regla-cafe-central',
      userId: 'usuario-1',
      keyword: 'cafe central',
      categoria: 'restaurantes',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'regla-vacia',
      userId: 'usuario-1',
      keyword: '',
      categoria: 'sin-clasificar',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ];

  it('debe elegir la keyword coincidente más específica sin distinguir mayúsculas', () => {
    // Arrange
    const texto = 'Compra en CAFE CENTRAL hoy';

    // Act
    const sugerencia = sugerirCategoria(texto, reglas);

    // Assert
    expect(sugerencia).toEqual({
      categoria: 'restaurantes',
      reglaId: 'regla-cafe-central',
    });
  });

  it('debe devolver null cuando ninguna keyword coincide', () => {
    // Arrange
    const texto = 'farmacia';

    // Act
    const sugerencia = sugerirCategoria(texto, reglas);

    // Assert
    expect(sugerencia).toBeNull();
  });

  it('no debe considerar coincidente una keyword vacía', () => {
    // Arrange
    const texto = 'cualquier texto';
    const reglasVacias = [reglas[2]];

    // Act
    const sugerencia = sugerirCategoria(texto, reglasVacias);

    // Assert
    expect(sugerencia).toBeNull();
  });
});
