import { CreateAuthUsers1760000000000 } from "@/configuration/migrations/1760000000000-create-auth-users";
import { AuthUserEntitySchema } from "@/features/auth/auth-user.entity";

export const databaseEntities = [AuthUserEntitySchema];

export const databaseMigrations = [CreateAuthUsers1760000000000];
