import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { requireJwtAuth } from "@/configuration/middlewares/jwt-middleware";
import { parseRequestBody } from "@/configuration/validation/request";
import {
  createBlobUploadUrlRequestSchema,
  type CreateBlobUploadUrlRequestBody,
  type CreateBlobUploadUrlInput,
} from "@/features/blob/blob.model";
import { BlobService } from "@/features/blob/blob.service";

export class BlobController {
  constructor(private readonly blobService: BlobService) {}

  createUploadUrl = async (context: Context<AppBindings>): Promise<Response> => {
    await requireJwtAuth(context);
    const input = await parseRequestBody(context, createBlobUploadUrlRequestSchema);
    const result = this.blobService.createUploadUrl(this.toCreateBlobUploadUrlInput(context, input));

    return context.json(result, 201);
  };

  private toCreateBlobUploadUrlInput(
    context: Context<AppBindings>,
    input: CreateBlobUploadUrlRequestBody,
  ): CreateBlobUploadUrlInput {
    return {
      userId: context.get("auth").sub,
      filename: input.filename,
      contentType: input.contentType,
      scope: input.scope,
    };
  }
}
