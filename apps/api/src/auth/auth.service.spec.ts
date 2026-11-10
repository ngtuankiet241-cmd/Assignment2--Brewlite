import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('UT-AUTH-01: hashes password and registers new user successfully', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: 'usr-1',
        email: 'test@example.com',
        fullName: 'Nguyễn Văn A',
        phone: '0901234567',
        role: Role.CUSTOMER,
        loyaltyPoints: 0,
        createdAt: new Date(),
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Nguyễn Văn A',
        phone: '0901234567',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toEqual('test@example.com');
      expect(mockUsersService.create).toHaveBeenCalled();
    });

    it('UT-AUTH-04: rejects registration if email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.register({
          email: 'duplicate@example.com',
          password: 'password123',
          fullName: 'Nguyễn Văn B',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('UT-AUTH-02: returns JWT accessToken on valid credentials', async () => {
      const hashedPassword = service.hashPassword('mypassword123');
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'usr-2',
        email: 'user@example.com',
        password: hashedPassword,
        fullName: 'User Two',
        phone: null,
        role: Role.CUSTOMER,
        loyaltyPoints: 50,
      });

      const result = await service.login({
        email: 'user@example.com',
        password: 'mypassword123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toEqual('user@example.com');
    });

    it('UT-AUTH-03: rejects login with incorrect password', async () => {
      const hashedPassword = service.hashPassword('correct-pass');
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'usr-2',
        email: 'user@example.com',
        password: hashedPassword,
        role: Role.CUSTOMER,
      });

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'wrong-pass',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

