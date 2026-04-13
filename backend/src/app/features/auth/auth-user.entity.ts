import { EntitySchema } from "typeorm";

export interface AuthUserEntity {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const AuthUserEntitySchema = new EntitySchema<AuthUserEntity>({
  name: "AuthUser",
  tableName: "auth_users",
  columns: {
    id: {
      type: String,
      primary: true,
      length: 36,
    },
    email: {
      type: String,
      unique: true,
      length: 255,
    },
    passwordHash: {
      name: "password_hash",
      type: String,
      length: 255,
    },
    firstName: {
      name: "first_name",
      type: String,
      length: 255,
      nullable: true,
    },
    lastName: {
      name: "last_name",
      type: String,
      length: 255,
      nullable: true,
    },
    role: {
      type: String,
      length: 50,
    },
    emailVerified: {
      name: "email_verified",
      type: Boolean,
      default: false,
    },
    createdAt: {
      name: "created_at",
      type: "datetime",
      createDate: true,
    },
    updatedAt: {
      name: "updated_at",
      type: "datetime",
      updateDate: true,
    },
  },
});
