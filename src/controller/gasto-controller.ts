import type {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import {
    ok,
    created,
    badRequest,
    notFound,
} from '../lib/httpResponse';

import { logger } from '../lib/logger';
import { getUserId } from '../lib/identity';
import {
    parseActualizarGasto,
    parseCrearGasto,
} from '../lib/validate';
import {gastoService} from "../services/gasto-service";

export class GastoController {
    async crearGasto(event: APIGatewayProxyEventV2WithJWTAuthorizer,) {
        const userId = getUserId(event);
        const input = parseCrearGasto(event.body);
        const gasto = await gastoService.crear(userId, input);
        logger.info({ operation: 'expense_created' });
        return created(gasto);
    }

    async eliminarGasto(
        event: APIGatewayProxyEventV2WithJWTAuthorizer,
    ): Promise<APIGatewayProxyStructuredResultV2> {
            const userId = getUserId(event);
            const id = event.pathParameters?.id;
            if (!id) return badRequest('Falta el id del gasto');
            const eliminado = await gastoService.eliminar(userId, id);
            return eliminado
                ? ok({ id, eliminado: true })
                : notFound('Gasto no encontrada');
    }

    async listarGastos(
        event: APIGatewayProxyEventV2WithJWTAuthorizer,
    ): Promise<APIGatewayProxyStructuredResultV2> {
        const userId = getUserId(event);
        const q = event.queryStringParameters ?? {};
        const gastos = await gastoService.listar(userId, { mes: q.mes, categoria: q.categoria, metodoPago: q.metodo });
        return ok({ total: gastos.length, gastos });
    }

    async actualizarGasto(
        event: APIGatewayProxyEventV2WithJWTAuthorizer,
    ): Promise<APIGatewayProxyStructuredResultV2>{
            const userId = getUserId(event);
            const id = event.pathParameters?.id;
            if (!id) return badRequest('Falta el id del gasto');
            const data = parseActualizarGasto(event.body);
            const gastoUpdated = await gastoService.actualizar(userId, id, data);
            return ok({ gastoUpdated });
    }

    async findById(
        event: APIGatewayProxyEventV2WithJWTAuthorizer,
    ): Promise<APIGatewayProxyStructuredResultV2>{
            const userId = getUserId(event);
            const id = event.pathParameters?.id;
            if (!id) return badRequest('Falta el id del gasto');
            const gasto = await gastoService.obtener(userId, id);
            return gasto ? ok(gasto) : notFound('Gasto no encontrado');
    }
}

export const gastosController =
    new GastoController();