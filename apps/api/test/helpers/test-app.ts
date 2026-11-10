import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestApplication {
  app: INestApplication;
  prisma: PrismaService;
  close(): Promise<void>;
}

export async function createTestApplication(): Promise<TestApplication> {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('E2E tests require TEST_DATABASE_URL or DATABASE_URL.');
  }

  // Each suite owns a new schema. Never clean tables in the configured schema.
  const schema = `brewlite_e2e_${randomUUID().replace(/-/g, '')}`;
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schema);

  const prisma = new PrismaService({ datasourceUrl: url.toString() });
  let app: INestApplication | undefined;

  const close = async () => {
    try {
      // The identifier contains only a fixed prefix and a generated UUID.
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      try {
        await app?.close();
      } finally {
        await prisma.$disconnect();
      }
    }
  };

  try {
    const apiDirectory = resolve(__dirname, '../..');
    execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        resolve(apiDirectory, 'prisma/schema.prisma'),
      ],
      {
        cwd: apiDirectory,
        env: { ...process.env, DATABASE_URL: url.toString() },
        timeout: 30000,
        stdio: 'pipe',
      },
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    return { app, prisma, close };
  } catch (error) {
    await close();
    throw error;
  }
}
