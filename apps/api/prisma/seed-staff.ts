
import { PrismaClient, Role } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');

  return `${salt}:${hash}`;
}

async function main() {
  const email = 'staff@brewlite.local';
  const password = process.env.SEED_STAFF_PASSWORD;

  if (!password || password.length < 8) {
    throw new Error('Mật khẩu nhân viên phải có ít nhất 8 ký tự.');
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    if (existing.role !== Role.BARISTA) {
      throw new Error('Email đã tồn tại với quyền khác BARISTA.');
    }

    console.log('Tài khoản nhân viên đã tồn tại, không tạo trùng.');
    return;
  }

  await prisma.user.create({
    data: {
      email,
      password: hashPassword(password),
      fullName: 'Nhân viên BrewLite',
      role: Role.BARISTA,
    },
  });

  console.log('Đã tạo tài khoản nhân viên BrewLite thành công!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
