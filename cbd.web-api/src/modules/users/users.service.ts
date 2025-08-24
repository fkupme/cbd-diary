import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PaginationMetadata } from '../../common/types/api-response.type';
import { PrismaService } from '../../database/prisma.service';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto/user.dto';

interface PaginatedResult<T> {
  data: T[];
  metadata: PaginationMetadata;
}

interface UserQueryDto {
  page?: number;
  limit?: number;
  search?: string;
}

function toEnumUpper(value?: string | null): string | undefined {
  if (!value) return undefined;
  return String(value).toUpperCase();
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: UserQueryDto,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const mappedUsers = users.map((user) => this.mapToResponseDto(user));

    const metadata: PaginationMetadata = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    return {
      data: mappedUsers,
      metadata,
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    return this.mapToResponseDto(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь с email ${email} не найден`);
    }

    return this.mapToResponseDto(user);
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Проверяем уникальность email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });

    return this.mapToResponseDto(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    // Проверяем уникальность email, если он изменяется
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const userWithSameEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (userWithSameEmail) {
        throw new ConflictException(
          'Пользователь с таким email уже существует',
        );
      }
    }

    const data: any = {};
    if (typeof updateUserDto.name !== 'undefined')
      data.name = updateUserDto.name;
    if (typeof updateUserDto.email !== 'undefined')
      data.email = updateUserDto.email;
    if (typeof updateUserDto.preferredLanguage !== 'undefined')
      data.preferredLanguage = updateUserDto.preferredLanguage;
    if (typeof updateUserDto.isActive !== 'undefined')
      data.isActive = updateUserDto.isActive;
    if (typeof updateUserDto.age !== 'undefined')
      data.age = updateUserDto.age as any;

    // Нормализуем строковые значения к enum'ам Prisma
    if (typeof updateUserDto.gender !== 'undefined')
      data.gender = toEnumUpper(updateUserDto.gender) as any; // MALE/FEMALE/OTHER/PREFER_NOT_TO_SAY
    if (typeof updateUserDto.experienceLevel !== 'undefined')
      data.experienceLevel = toEnumUpper(updateUserDto.experienceLevel) as any; // BEGINNER/INTERMEDIATE/ADVANCED
    if (typeof updateUserDto.meditationFrequency !== 'undefined')
      data.meditationFrequency = toEnumUpper(
        updateUserDto.meditationFrequency,
      ) as any; // NEVER/RARELY/SOMETIMES/OFTEN/DAILY

    if (typeof updateUserDto.goals !== 'undefined')
      data.goals = updateUserDto.goals as any;
    if (typeof updateUserDto.stressLevel !== 'undefined')
      data.stressLevel = updateUserDto.stressLevel as any;
    if (typeof updateUserDto.sleepQuality !== 'undefined')
      data.sleepQuality = updateUserDto.sleepQuality as any;
    if (typeof updateUserDto.timezone !== 'undefined')
      data.timezone = updateUserDto.timezone;
    if (typeof updateUserDto.pushEnabled !== 'undefined')
      data.pushEnabled = updateUserDto.pushEnabled as any;
    if (typeof updateUserDto.dateOfBirth !== 'undefined')
      data.dateOfBirth = updateUserDto.dateOfBirth
        ? (new Date(updateUserDto.dateOfBirth) as any)
        : null;

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.mapToResponseDto(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    await this.prisma.user.delete({
      where: { id },
    });
  }

  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    // Проверяем текущий пароль
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Неверный текущий пароль');
    }

    // Хешируем новый пароль
    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      12,
    );

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedNewPassword },
    });
  }

  async validatePassword(
    email: string,
    password: string,
  ): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return this.mapToResponseDto(user);
  }

  // Приватные методы

  private mapToResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      preferredLanguage: user.preferredLanguage,
      isActive: user.isActive ?? true,
      pushEnabled: user.pushEnabled ?? true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...(typeof user.dateOfBirth !== 'undefined'
        ? { dateOfBirth: user.dateOfBirth }
        : {}),
      // Доп поля для фронта (не описаны в DTO классе swagger, но отдаются клиенту)
      ...(typeof user.age !== 'undefined' ? { age: user.age } : {}),
      ...(typeof user.gender !== 'undefined' ? { gender: user.gender } : {}),
      ...(typeof user.goals !== 'undefined' ? { goals: user.goals } : {}),
      ...(typeof user.experienceLevel !== 'undefined'
        ? { experienceLevel: user.experienceLevel }
        : {}),
      ...(typeof user.meditationFrequency !== 'undefined'
        ? { meditationFrequency: user.meditationFrequency }
        : {}),
      ...(typeof user.stressLevel !== 'undefined'
        ? { stressLevel: user.stressLevel }
        : {}),
      ...(typeof user.sleepQuality !== 'undefined'
        ? { sleepQuality: user.sleepQuality }
        : {}),
      ...(typeof user.timezone !== 'undefined'
        ? { timezone: user.timezone }
        : {}),
    } as any;
  }
}
