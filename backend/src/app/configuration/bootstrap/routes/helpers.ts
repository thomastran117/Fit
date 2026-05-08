import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import {
  getRequestContainer,
  type ServiceToken,
} from "@/configuration/bootstrap/container";

export type ControllerHandlerName<TController> = {
  [TKey in keyof TController]: TController[TKey] extends (
    context: Context<AppBindings>,
  ) => Promise<Response>
    ? TKey
    : never;
}[keyof TController];

export function resolveHandler<TController>(
  token: ServiceToken<TController>,
  handlerName: ControllerHandlerName<TController>,
) {
  return async (context: Context<AppBindings>): Promise<Response> => {
    const controller = getRequestContainer(context).resolve(token);
    const handler = controller[handlerName] as (
      context: Context<AppBindings>,
    ) => Promise<Response>;
    return handler(context);
  };
}
