import {
    BatchWriteCommand,
    type BatchWriteCommandInput,
    DeleteCommand,
    GetCommand,
    PutCommand,
    QueryCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/dynamo';
import { config } from '../config/env';
import { itemKey, type GastoItem, type Gasto, UMBRAL_HORMIGA, buildKeys } from '../domain/gasto';
import { AppError } from '../lib/errors';

const MAX_BATCH_WRITE_RETRIES = 3;
const BASE_BATCH_WRITE_DELAY_MS = 25;

export class UnprocessedItemsError extends AppError {
    constructor(readonly count: number) {
        super('DYNAMODB_UNPROCESSED_ITEMS', true, count);
        this.name = 'UnprocessedItemsError';
    }
}

const esperar = (durationMs: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, durationMs));

export interface ListarFiltros {
    mes?: string;
    categoria?: string;
    metodoPago?: string;
}

export class GastoRepository {
    constructor(
        private readonly dynamo = ddb,
        private readonly table = config.tableName,
        private readonly wait: (durationMs: number) => Promise<void> = esperar,
    ) {}

    async put(item: GastoItem): Promise<void> {
        await this.dynamo.send(new PutCommand({ TableName: this.table, Item: item }));
    }

    async get(userId: string, id: string): Promise<GastoItem | null> {
        const res = await this.dynamo.send(
            new GetCommand({ TableName: this.table, Key: itemKey(userId, id) }),
        );
        return (res.Item as GastoItem) ?? null;
    }

    async delete(userId: string, id: string): Promise<boolean> {
        const res = await this.dynamo.send(
            new DeleteCommand({
                TableName: this.table,
                Key: itemKey(userId, id),
                ReturnValues: 'ALL_OLD',
            }),
        );
        return !!res.Attributes;
    }

    async update(
        userId: string,
        id: string,
        data: Partial<Gasto>,
    ): Promise<GastoItem | null> {
        const gasto = await this.get(userId, id);
        if (!gasto) {
            return null;
        }

        const fusionado = {
            ...gasto,
            ...data,
            esHormiga: (data.monto ?? gasto.monto) < UMBRAL_HORMIGA,
            updatedAt: new Date().toISOString(),
        };

        const updatedItem: GastoItem = {
            ...fusionado,
            ...buildKeys(userId, id, fusionado.fecha),
        };

        await this.dynamo.send(new PutCommand({ TableName: this.table, Item: updatedItem }));
        return updatedItem;
    }

    async listar(userId: string, filtros: ListarFiltros = {}): Promise<GastoItem[]> {
        if (filtros.mes) {
            const res = await this.dynamo.send(
                new QueryCommand({
                    TableName: this.table,
                    IndexName: 'GSI1',
                    KeyConditionExpression: 'GSI1PK = :pk',
                    ExpressionAttributeValues: { ':pk': `USER#${userId}#${filtros.mes}` },
                    ScanIndexForward: false,
                }),
            );
            return this.applyFilters((res.Items as GastoItem[]) ?? [], filtros);
        }

        const res = await this.dynamo.send(
            new QueryCommand({
                TableName: this.table,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'GASTO#' },
                ScanIndexForward: false,
            }),
        );
        return this.applyFilters((res.Items as GastoItem[]) ?? [], filtros);
    }

    private applyFilters(items: GastoItem[], filtros: ListarFiltros): GastoItem[] {
        return items.filter(
            (g) =>
                (!filtros.categoria || g.categoria === filtros.categoria) &&
                (!filtros.metodoPago || g.metodoPago === filtros.metodoPago),
        );
    }

    async escanearGastos(): Promise<GastoItem[]> {
        const items: GastoItem[] = [];
        let res = await this.dynamo.send(new ScanCommand({
            TableName: this.table,
            FilterExpression: 'begins_with(SK, :sk)',
            ExpressionAttributeValues: { ':sk': 'GASTO#' },
        }));
        items.push(...((res.Items as GastoItem[]) ?? []));
        while (res.LastEvaluatedKey) {
            res = await this.dynamo.send(new ScanCommand({
                TableName: this.table,
                FilterExpression: 'begins_with(SK, :sk)',
                ExpressionAttributeValues: { ':sk': 'GASTO#' },
                ExclusiveStartKey: res.LastEvaluatedKey,
            }));
            items.push(...((res.Items as GastoItem[]) ?? []));
        }
        return items;
    }

    async putLote(items: GastoItem[]): Promise<void> {
        for (let i = 0; i < items.length; i += 25) {
            const lote = items.slice(i, i + 25);
            let pendientes: NonNullable<BatchWriteCommandInput['RequestItems']>[string] =
                lote.map((Item) => ({ PutRequest: { Item } }));

            for (let intento = 0; intento <= MAX_BATCH_WRITE_RETRIES; intento += 1) {
                const respuesta = await this.dynamo.send(new BatchWriteCommand({
                    RequestItems: { [this.table]: pendientes },
                }));
                pendientes = respuesta.UnprocessedItems?.[this.table] ?? [];
                if (pendientes.length === 0) break;

                if (intento === MAX_BATCH_WRITE_RETRIES) {
                    throw new UnprocessedItemsError(pendientes.length);
                }

                await this.wait(BASE_BATCH_WRITE_DELAY_MS * (2 ** intento));
            }
        }
    }
}

export const gastoRepository = new GastoRepository();