import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    // Also match accounts created before emails were normalized at registration.
    return this.prisma.user.findFirst({
      where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        loyaltyPoints: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với id ${id}`);
    }

    return user;
  }

  async create(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: Role;
  }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone,
        role: data.role || Role.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        loyaltyPoints: true,
        createdAt: true,
      },
    });
  }
}

