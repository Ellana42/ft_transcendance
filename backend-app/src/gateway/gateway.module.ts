import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { GameGateway } from './game.gateway';
import { ChatMessagesModule } from 'src/chat-messages/chat-messages.module';
import { ChatsModule } from 'src/chats/chats.module';
import { UsersModule } from 'src/users/users.module';
import { FriendsModule } from 'src/friends/friends.module';
import { GamesModule } from 'src/games/games.module';
import { ChatParticipantsModule } from 'src/chat-participants/chat-participants.module';
import { InvitesModule } from 'src/invites/invites.module';
import { AuthService } from 'src/auth/auth.service';
import { PasswordService } from 'src/password/password.service';
import { JwtService } from '@nestjs/jwt';
import { PasswordModule } from 'src/password/password.module';
import { BlockedUsersModule } from 'src/blocked-users/blockedUsers.module';

@Module({
  imports: [
    forwardRef(() => ChatsModule),
    forwardRef(() => ChatMessagesModule),
    forwardRef(() => UsersModule),
    forwardRef(() => FriendsModule),
    forwardRef(() => ChatParticipantsModule),
    forwardRef(() => GamesModule),
    forwardRef(() => InvitesModule),
    forwardRef(() => PasswordModule),
    forwardRef(() => BlockedUsersModule),
  ],
  providers: [
    ChatGateway,
    GameGateway,
    PasswordService,
    AuthService,
    JwtService,
  ],
  exports: [ChatGateway, GameGateway],
})
export class GatewayModule {}
