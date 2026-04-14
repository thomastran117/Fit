import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { parseRequestBody } from "@/configuration/validation/request";
import type {
  UpdateProfileInput,
  UpdateProfileRequestBody,
} from "@/features/profile/profile.model";
import { updateProfileRequestSchema } from "@/features/profile/profile.model";
import { ProfileService } from "@/features/profile/profile.service";

export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  getMe = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.profileService.getByUserId(context.get("auth").sub);
    return context.json(result);
  };

  updateMe = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, updateProfileRequestSchema);
    const result = await this.profileService.update(this.toUpdateProfileInput(context, input));
    return context.json(result);
  };

  private toUpdateProfileInput(
    context: Context<AppBindings>,
    input: UpdateProfileRequestBody,
  ): UpdateProfileInput {
    return {
      userId: context.get("auth").sub,
      username: input.username,
      phoneNumber: input.phoneNumber,
      avatarUrl: input.avatarUrl,
      avatarBlobName: input.avatarBlobName,
      trustworthinessScore: input.trustworthinessScore,
      rentPostingsCount: input.rentPostingsCount,
      availableRentPostingsCount: input.availableRentPostingsCount,
    };
  }
}
