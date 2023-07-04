import { Module, ParseIntPipe } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './typeorm/entities/user.entity';
import { UsersModule } from './users/users.module';
import { ChatsModule } from './chats/chats.module';
import { FriendsModule } from './friends/friends.module';
import { GamesModule } from './games/games.module';
import { ChatEntity } from './typeorm/entities/chat.entity';
import { FriendEntity } from './typeorm/entities/friend.entity';
import { GameEntity } from './typeorm/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    entities: [UserEntity, ChatEntity, FriendEntity, GameEntity],
    synchronize: true,
  }), UsersModule, ChatsModule, FriendsModule, GamesModule,],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
