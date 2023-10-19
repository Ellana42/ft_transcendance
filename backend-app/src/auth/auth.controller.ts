import { Inject, forwardRef } from '@nestjs/common';
import {
  Controller,
  Body,
  Get,
  HttpCode,
  Post,
  Request,
  Req,
  Response,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { school42AuthGuard } from './guards/school42-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject(forwardRef(() => UsersService))
    private userService: UsersService,
  ) {}

  @UseGuards(LocalAuthGuard)
  @Post('auth/login')
  async login(@Request() req: any): Promise<any> {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any): any {
    return req.user;
  }

  @Get('auth/42login')
  @UseGuards(school42AuthGuard)
  async school42Auth(): Promise<void> {
    console.log('[Auth Controller]: GET on auth/42login');
  }

  @Get('auth/callback')
  @UseGuards(school42AuthGuard)
  school42AuthRedirect(
    @Request() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): void {
    console.log('[Auth Controller]: GET on auth/callback');
    return this.authService.school42Login(req, res);
  }

  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  async register(@Response() response, @Request() request) {
    const { otpAuthUrl } =
      await this.authService.generateTwoFactorAuthenticationSecret(
        request.user,
      );

    return response.json(
      await this.authService.generateQrCodeDataURL(otpAuthUrl),
    );
  }

  @Post('2fa/turn-on')
  @UseGuards(JwtAuthGuard)
  async turnOnTwoFactorAuthentication(@Req() request, @Body() body) {
    const isCodeValid = this.authService.isTwoFactorAuthenticationCodeValid(
      body.twoFactorAuthenticationCode,
      request.user,
    );
    if (!isCodeValid) {
      throw new UnauthorizedException('Wrong authentication code');
    }
    await this.userService.turnOnTwoFactorAuthentication(request.user.id);
  }

  @Post('2fa/authenticate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async authenticate(@Request() request, @Body() body) {
    const isCodeValid = this.authService.isTwoFactorAuthenticationCodeValid(
      body.twoFactorAuthenticationCode,
      request.user,
    );

    if (!isCodeValid) {
      throw new UnauthorizedException('Wrong authentication code');
    }

    return this.authService.loginWith2fa(request.user);
  }
}
