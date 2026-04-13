import {
  type MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from "typeorm";

export class CreateAuthUsers1760000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "auth_users",
        columns: [
          {
            name: "id",
            type: "varchar",
            length: "36",
            isPrimary: true,
            isNullable: false,
          },
          {
            name: "email",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "password_hash",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "first_name",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "last_name",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "role",
            type: "varchar",
            length: "50",
            isNullable: false,
          },
          {
            name: "email_verified",
            type: "boolean",
            default: false,
            isNullable: false,
          },
          {
            name: "created_at",
            type: "datetime",
            precision: 6,
            default: "CURRENT_TIMESTAMP(6)",
            isNullable: false,
          },
          {
            name: "updated_at",
            type: "datetime",
            precision: 6,
            default: "CURRENT_TIMESTAMP(6)",
            onUpdate: "CURRENT_TIMESTAMP(6)",
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      "auth_users",
      new TableIndex({
        name: "IDX_auth_users_email",
        columnNames: ["email"],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("auth_users", "IDX_auth_users_email");
    await queryRunner.dropTable("auth_users", true);
  }
}
