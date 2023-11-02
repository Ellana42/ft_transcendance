import { UserEntity } from 'src/users/entities/user.entity';

export type createUserParams = {
  username: string;
  login42?: string;
  password?: string;
  email: string;
};

export type updateUserParams = {
  username?: string;
  password?: string;
  newPassword?: string;
  currentPassword?: string;
  email?: string;
};
