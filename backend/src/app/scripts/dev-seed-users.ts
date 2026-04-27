import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { loadEnvironment } from "@/configuration/environment/index";
import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseClient,
} from "@/configuration/resources/database";
import { ensureDevFixturePostings } from "@/scripts/dev-seed-postings";

const BCRYPT_SALT_ROUNDS = 12;

type FixtureRole = "owner" | "user" | "admin";

interface DevFixtureUser {
  id: string;
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  role: FixtureRole;
}

const DEV_FIXTURE_USERS: DevFixtureUser[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    email: "owner1@rentify.local",
    password: "Rentify123!",
    username: "owner-one",
    firstName: "Owner",
    lastName: "One",
    role: "owner",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "owner2@rentify.local",
    password: "Rentify123!",
    username: "owner-two",
    firstName: "Owner",
    lastName: "Two",
    role: "owner",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    email: "user1@rentify.local",
    password: "Rentify123!",
    username: "user-one",
    firstName: "User",
    lastName: "One",
    role: "user",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    email: "admin1@rentify.local",
    password: "Rentify123!",
    username: "admin-one",
    firstName: "Admin",
    lastName: "One",
    role: "admin",
  },
];

async function ensureDevFixtureUsers(): Promise<void> {
  const prisma = getDatabaseClient();
  const passwordHashByValue = new Map<string, string>();
  const userIdsByEmail = new Map<string, string>();

  for (const fixtureUser of DEV_FIXTURE_USERS) {
    const passwordHash = await getPasswordHash(passwordHashByValue, fixtureUser.password);

    const user = await prisma.user.upsert({
      where: {
        email: fixtureUser.email,
      },
      update: {
        passwordHash,
        firstName: fixtureUser.firstName,
        lastName: fixtureUser.lastName,
        role: fixtureUser.role,
        emailVerified: true,
      },
      create: {
        id: fixtureUser.id,
        email: fixtureUser.email,
        passwordHash,
        firstName: fixtureUser.firstName,
        lastName: fixtureUser.lastName,
        role: fixtureUser.role,
        emailVerified: true,
      },
      select: {
        id: true,
      },
    });

    userIdsByEmail.set(fixtureUser.email, user.id);

    await prisma.profile.upsert({
      where: {
        userId: user.id,
      },
      update: {
        username: fixtureUser.username,
        isPrivate: false,
      },
      create: {
        id: randomUUID(),
        userId: user.id,
        username: fixtureUser.username,
        isPrivate: false,
      },
    });

    console.info(
      `Ensured dev fixture user ${fixtureUser.email} (${fixtureUser.role}) with username ${fixtureUser.username}.`,
    );
  }

  await ensureDevFixturePostings(userIdsByEmail);
  console.info(`Ensured ${DEV_FIXTURE_USERS.length} dev fixture users.`);
}

async function getPasswordHash(
  passwordHashByValue: Map<string, string>,
  password: string,
): Promise<string> {
  const existingHash = passwordHashByValue.get(password);

  if (existingHash) {
    return existingHash;
  }

  const nextHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  passwordHashByValue.set(password, nextHash);
  return nextHash;
}

async function main(): Promise<void> {
  loadEnvironment();
  await connectDatabase();

  try {
    await ensureDevFixtureUsers();
  } finally {
    await disconnectDatabase();
  }
}

void main().catch(async (error: unknown) => {
  console.error("Failed to seed dev fixture users.", error);
  await disconnectDatabase();
  process.exit(1);
});
