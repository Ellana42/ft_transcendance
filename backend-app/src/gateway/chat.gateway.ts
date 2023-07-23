import { OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket as ioSocket } from 'socket.io';
import { ChatMessagesService } from 'src/chat-messages/chat-messages.service';
import { ChatParticipantsService } from 'src/chat-participants/chat-participants.service';
import { ChatsService } from 'src/chats/chats.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost'],
  },
})
export class ChatGateway implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => ChatMessagesService))
    private chatMessagesService: ChatMessagesService,
    @Inject(forwardRef(() => ChatsService))
    private chatsService: ChatsService,
    @Inject(forwardRef(() => ChatParticipantsService))
    private chatParticipantsService: ChatParticipantsService,
  ) {}
  @WebSocketServer()
  server: Server;

  onModuleInit() {
    this.server.on('connection', (socket) => {
      console.log(socket.id);

      console.log('A user connected');

      socket.broadcast.emit('connection event');
      socket.on('disconnect', () => {
        console.log('a user disconnected');
        socket.broadcast.emit('disconnection event');
      });
    });
  }

  @SubscribeMessage('chat message')
  onChatMessage(@MessageBody() msg: any, @ConnectedSocket() socket: ioSocket) {
    socket.broadcast.emit('chat message', msg);
    this.chatMessagesService
      .createMessage(msg.msg, msg.sender, msg.channel, msg.datestamp)
      .catch((err: any) => {
        console.log(err);
      });
  }

  @SubscribeMessage('delete chat')
  async onDeleteChat(@MessageBody() info: any) {
    var entity = await this.chatsService.fetchChatByName(info);
    var id = entity.id;

    this.chatsService.deleteChatByID(id).catch((err: any) => {
      console.log(err);
    });
    this.server.emit('delete chat', info);
  }

  @SubscribeMessage('add chat')
  async onAddChat(@MessageBody() info: any) {
    this.chatsService.createChat(info);
    this.server.emit('add chat', info);
  }

  @SubscribeMessage('join chat')
  async onJoinChat(@MessageBody() info: any) {
    try {
      this.chatsService.addParticipantToChatByUsername(
        info.channel_name,
        info.username,
      );
      this.server.emit('join chat', info);
    } catch (e) {
      console.log('Chat join Error');
    }
  }

  @SubscribeMessage('mute')
  async onMute(@MessageBody() info: any) {
    console.log('MUTE info');
    console.log(info);
    try {
      if (
        this.chatParticipantsService.userIsOwner(
          info.channel_name,
          info.current_user,
        )
      ) {
        var participant =
          await this.chatParticipantsService.fetchParticipantByUserChatNames(
            info.current_user,
            info.channel_name,
          );
        console.log(participant);
        this.chatParticipantsService.updateParticipantByID(participant.id, {
          operator: participant.operator,
          banned: participant.banned,
          owner: participant.owner,
          muted: true,
        });
        console.log('updated participant');
        this.server.emit('mute', info);
        console.log('Muted in theory');
      } else {
        console.log("This user is not operator. They can't mute.");
      }
    } catch (e) {
      console.log('Mute Error');
      console.log(e);
    }
  }
}
