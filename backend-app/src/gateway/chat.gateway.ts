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
import { ChatParticipantEntity } from 'src/chat-participants/entities/chat-participant.entity';
import { ChatsService } from 'src/chats/chats.service';
import { ChatCreationError, ChatJoinError, ChatMuteError, ChatPermissionError } from 'src/exceptions/bad-request.interceptor';
import { UsersService } from 'src/users/users.service';

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
    @Inject(forwardRef(() => UsersService))
    private userService: UsersService,
  ) {}
  @WebSocketServer()
  server: Server;

  onModuleInit() {
    this.server.on('connection', (socket) => {
      console.log('[Chat Gateway]: A user connected', socket.id);
      socket.broadcast.emit('connection event');
      socket.on('disconnect', () => {
        console.log('[Chat Gateway]: A user disconnected', socket.id);
        socket.broadcast.emit('disconnection event');
      });
    });
  }

  // -------------------- EVENTS

  @SubscribeMessage('add chat')
  async onAddChat(@MessageBody() info: any) {
    console.log('[Chat Gateway]: Add chat', info);
    try {
      await this.chatsService.createChat(info);
      this.server.emit('add chat', info);
    }
    catch (e) {
      console.log("[Chat Gateway]: Chat creation error:", e.message);
    }
  }

  @SubscribeMessage('dm')
  async onDM(@MessageBody() info: any) {
    try {
      var params = {
        name: `DM: ${info.current_user} / ${info.target_user}`,
        password: '',
        user1: info.current_user,
        user2: info.target_user,
      };
      await this.chatsService.createChatDM(params);
      this.server.emit('dm', params);
    } catch (e) {
      console.log("[Chat Gateway]: DM creation error:", e.message);
    }
  }

  @SubscribeMessage('delete chat')
  async onDeleteChat(@MessageBody() info: any) {
    console.log('[Chat Gateway]: Delete chat', info);
    try {
      const chat = await this.chatsService.fetchChatByName(info);
      await this.chatsService.deleteChatByID(chat.id);
      this.server.emit('delete chat', info);
    }
    catch (e) {
      console.log("[Chat Gateway]: Chat deletion error:", e.message);
    }
  }

  @SubscribeMessage('join chat')
  async onJoinChat(@MessageBody() info: any) {
    console.log("[Chat Gateway]: Join chat", info);
    try {
      await this.addUserToChat(info.username, info.channel_name);
      this.server.emit('join chat', info);
    } catch (e) {
      console.log("[Chat Gateway]: Chat join error:", e.message);
    }
  }

  @SubscribeMessage('leave chat')
  async onLeaveChat(@MessageBody() info: any) {
    try {
      await this.chatsService.removeParticipantFromChatByUsername(
        info.channel_name,
        info.username,
      );
      this.server.emit('leave chat', info);
    } catch (e) {
      console.log("[Chat Gateway]: Chat leave error:", e.message);
    }
  }

  @SubscribeMessage('chat message')
  async onChatMessage(
    @MessageBody() msg: any,
    @ConnectedSocket() socket: ioSocket,
  ) {
    console.log("[Chat Gateway]: Sending chat message");
    try {
      await this.registerChatMessage(msg.channel, msg.sender, msg.msg, msg.datestamp);
      this.server.emit('chat message', msg);
    }
    catch (e) {
      console.log("[Chat Gateway]: Chat message registration error:", e.message);
    }
  }

  @SubscribeMessage('mute')
  async onMute(@MessageBody() info: any) {
    try {
      info.mute_date = await this.toggleMute(info.channel_name, info.current_user, info.target_user, info.lenght_in_minutes);
      this.server.emit('mute', info);
    }
    catch (e) {
      console.log("[Chat Gateway]: User mute error:", e.message);
    }
  }

  @SubscribeMessage('toggle private')
  async onTogglePrivate(@MessageBody() info: any) {
    console.log('[Chat Gateway]: Toggle private chat');
    try {
      await this.toggleChatPrivacy(info.channel_name, info.sender);
      this.server.emit('toggle private', info);
    }
    catch (e) {
      console.log("[Chat Gateway]: Chat privacy toggle error:", e.message);
    }
  }

  @SubscribeMessage('invite')
  async onInvite(@MessageBody() info: any) {
    try {
      info.invite_date = new Date(
          Date.now() + 1 * (60 * 60 * 1000), // time + 1 hour
        ).getTime();
      await this.inviteUserUntil(info.channel_name, info.current_user, info.target_user, info.invite_date);
      this.server.emit('invite', info);
    }
    catch (e) {
      console.log("[Chat Gateway]: Chat invite error:", e.message);
    }
  }

  @SubscribeMessage('accept invite')
  async onAcceptInvite(@MessageBody() info: any) {
    try {
      await this.acceptUserInvite(info.channel_name, info.target_user);
      info.invite_date = 0;
      this.server.emit('accept invite', info);
    }
    catch (e) {
      console.log("[Chat Gateway]: Chat accept invite error:", e.message);
    }
  }

  @SubscribeMessage('operator')
  async onMakeOperator(@MessageBody() info: any) {
    try {
      await this.toggleOperator(info.channel_name, info.current_user, info.target_user);
      this.server.emit('operator', info);
    }
    catch (e) {
      console.log("[Chat Gateway]: Operator promotion error:", e.message);
    }
  }

  @SubscribeMessage('ban')
  async onBan(@MessageBody() info: any) {
    try {
      await this.banUser(info.channel_name, info.current_user, info.target_user);
      this.server.emit('ban', info);
    }
    catch (e) {
      console.log("[Chat Gateway]: User ban error:", e.message);
    }
  }

  @SubscribeMessage('kick')
  async onKick(@MessageBody() info: any) {
    try {
      await this.kickUser(info.channel_name, info.current_user, info.target_user);
      this.server.emit('kick', info);
    }
    catch (e) {
      console.log("[Chat Gateway]: User kick error:", e.message);
    }
  }



  // --------------------  PERMISSION CHECKS




  private async getParticipant(chatRoomName: string, username: string) {
    const chatRoom = await this.chatsService.fetchChatByName(chatRoomName);
    if (! chatRoom) {
      throw new ChatPermissionError(`Chat '${chatRoomName} does not exist.`);
    }
    const userParticipant = await this.chatParticipantsService.fetchParticipantByUserChatNames(username, chatRoomName);
    if (!userParticipant) {
      throw new ChatPermissionError(`User '${username} is not in or invited to chat '${chatRoomName}`);
    }
    return userParticipant;
  }

  private async checkUserIsOwner(user: ChatParticipantEntity) {
    if (!user) {
      throw new ChatPermissionError(`Unexpected error during owner permission check: participant does not exist.`);
    }
    if (!user.owner) {
      throw new ChatPermissionError(`User '${user.participant.username}' is not owner of chat '${user.chatRoom.name}'.`);
    }
  }

  private async checkUserIsNotOwner(user: ChatParticipantEntity) {
    if (!user) {
      throw new ChatPermissionError(`Unexpected error during owner permission check: participant does not exist.`);
    }
    if (user.owner) {
      throw new ChatPermissionError(`User '${user.participant.username}' is owner of chat '${user.chatRoom.name}'.`);
    }
  }

  private async checkUserHasOperatorPermissions(user: ChatParticipantEntity) {
    if (!user) {
      throw new ChatPermissionError(`Unexpected error during operator permission check: participant does not exist.`);
    }
    if (!user.operator && !user.owner) {
      throw new ChatPermissionError(`User '${user.participant.username}' does not have operator privileges in chat '${user.chatRoom.name}'.`);
    }
  }

  private async checkUserIsNotOperator(user: ChatParticipantEntity) {
    if (!user) {
      throw new ChatPermissionError(`Unexpected error during operator permission check: participant does not exist.`);
    }
    if (user.operator || user.owner) {
      throw new ChatPermissionError(`User '${user.participant.username}' is operator of chat '${user.chatRoom.name}'.`);
    }
  }

  private async checkUserIsNotBanned(user: ChatParticipantEntity) {
    if (!user) {
      throw new ChatPermissionError(`Unexpected error during operator permission check: participant does not exist.`);
    }
    if (user.banned) {
      throw new ChatPermissionError(`User '${user.participant.username}' is banned from chat '${user.chatRoom.name}'.`);
    }
  }

  private async checkUserIsNotMuted(user: ChatParticipantEntity) {
    if (!user) {
      throw new ChatPermissionError(`Unexpected error during muted check: participant does not exist.`);
    }
    if (user.mutedUntil > new Date().getTime()) {
      throw new ChatPermissionError(`User '${user.participant.username}' is muted in chat '${user.chatRoom.name}'.`);
    }
  }

  private async checkUserInviteIsNotPending(user: ChatParticipantEntity) {
    if (!user) {
      throw new ChatPermissionError(`Unexpected error during invite check: participant does not exist.`);
    }
    if (user.invitedUntil > new Date().getTime()) {
      throw new ChatPermissionError(`User '${user.participant.username}' invite to chat '${user.chatRoom.name}' is pending.`);
    }
  }

  private async checkUserInviteHasNotExpired(user: ChatParticipantEntity) {
    if (!user) {
      throw new ChatPermissionError(`Unexpected error during invite check: participant does not exist.`);
    }
    if (user.invitedUntil < new Date().getTime()) {
      throw new ChatPermissionError(`User '${user.participant.username}' invite to chat '${user.chatRoom.name}' has expired.`);
    }
  }

  private async checkUserHasNotAlreadyAcceptedInvite(user: ChatParticipantEntity) {
    if (!user) {
      throw new ChatPermissionError(`Unexpected error during invite check: participant does not exist.`);
    }
    if (user.invitedUntil === 0) {
      throw new ChatPermissionError(`User '${user.participant.username}' has already accepted invite to chat '${user.chatRoom.name}'.`);
    }
  }



  // -------------------- HANDLERS
  


  private async addUserToChat(username: string, chatRoomName: string) {
    const chatRoom = await this.chatsService.fetchChatByName(chatRoomName);
    const participant = await this.chatParticipantsService.fetchParticipantByUserChatNames(
      username,
      chatRoomName,
    );
    if (!chatRoom) {
      throw new ChatJoinError(`Chat '${chatRoomName}' does not exist.`);
    }
    if (chatRoom.private === true) {
      throw new ChatJoinError(`Chat '${chatRoomName}' is private.`);
    }
    if (participant && participant.invitedUntil === 0) {
      throw new ChatJoinError(`User '${username}' is already in chat '${chatRoomName}'.`);
    }
    if (participant && participant.banned) {
      throw new ChatJoinError(`User '${username}' is banned from chat '${chatRoomName}'.`);
    }
    this.chatsService.addParticipantToChatByUsername(
      chatRoomName,
      username,
    );
  }

  private async registerChatMessage(chatRoomName: string, username: string, message: string, date: Date) {
    const user = await this.getParticipant(chatRoomName, username);

    await this.checkUserIsNotMuted(user); 
    await this.checkUserIsNotBanned(user);

    await this.chatMessagesService.createMessage(
      message,
      user.participant.username,
      chatRoomName,
      date,
    );
  }

  private async toggleMute(chatRoomName: string, username: string, targetUsername: string, minutes: number) {
    const user = await this.getParticipant(chatRoomName, username);
    const target = await this.getParticipant(chatRoomName, targetUsername);

    await this.checkUserHasOperatorPermissions(user);
    await this.checkUserIsNotOperator(target);
    await this.checkUserIsNotBanned(target);

    if (user.mutedUntil > new Date().getTime()) {
      var newMutedTimestamp = new Date().getTime();
    }
    else {
      newMutedTimestamp = new Date(
        Date.now() + minutes * (60 * 1000),
        ).getTime();
    }
    var participant_update = {
      operator: target.operator,
      banned: target.banned,
      owner: target.owner,
      mutedUntil: newMutedTimestamp,
      invitedUntil: target.invitedUntil,
    };
    await this.chatParticipantsService.updateParticipantByID(
      target.id,
      participant_update,
    );
    return (participant_update.mutedUntil);
  }

  private async toggleOperator(chatRoomName: string, username: string, targetUsername: string) {
    const user = await this.getParticipant(chatRoomName, username);
    const target = await this.getParticipant(chatRoomName, targetUsername);

    await this.checkUserIsOwner(user);
    await this.checkUserIsNotOwner(target);
    await this.checkUserIsNotBanned(target);
    
    this.chatParticipantsService.updateParticipantByID(target.id, {
      operator: !target.operator,
      banned: target.banned,
      owner: target.owner,
      mutedUntil: target.mutedUntil,
      invitedUntil: target.invitedUntil,
    });
  }

  private async banUser(chatRoomName: string, username: string, targetUsername: string) {
    const user = await this.getParticipant(chatRoomName, username);
    const target = await this.getParticipant(chatRoomName, targetUsername);

    await this.checkUserHasOperatorPermissions(user);
    await this.checkUserIsNotOwner(target);

    if (target.banned) {
      this.chatParticipantsService.deleteParticipantByID(target.id);
    } else {
      this.chatParticipantsService.updateParticipantByID(target.id, {
        operator: target.operator,
        banned: true,
        owner: target.owner,
        mutedUntil: target.mutedUntil,
        invitedUntil: target.invitedUntil,
      });
    }
  }

  private async kickUser(chatRoomName: string, username: string, targetUsername: string) {
    const user = await this.getParticipant(chatRoomName, username);
    const target = await this.getParticipant(chatRoomName, targetUsername);

    await this.checkUserHasOperatorPermissions(user);
    await this.checkUserIsNotOwner(target);
    await this.checkUserIsNotBanned(target);

    this.chatParticipantsService.deleteParticipantInChatByUsername(
      target.participant.username,
      chatRoomName,
    );
  }

  private async toggleChatPrivacy(chatRoomName: string, username: string) {
    const user = await this.getParticipant(chatRoomName, username);
    const chatRoom = await this.chatsService.fetchChatByName(chatRoomName);

    await this.checkUserIsOwner(user);

    this.chatsService.updateChatByID(chatRoom.id, {
      name: chatRoom.name,
      private: !chatRoom.private,
      password: chatRoom.password,
      participantID: undefined,
    });
  }

  private async inviteUserUntil(chatRoomName: string, username: string, targetUsername: string, inviteUntil: number) {
    // TODO: Check if user has rights to invite target.
    const user = await this.getParticipant(chatRoomName, username);

    var target =
        await this.chatParticipantsService.fetchParticipantByUserChatNames(
          targetUsername,
          chatRoomName,
        );
    
    if (target) { // Target is in chan => has already been invited or accepted invite
      await this.checkUserHasNotAlreadyAcceptedInvite(target);
      await this.checkUserInviteIsNotPending(target);
      // If invite is not already accepted or still pending, it has expired,
      // which means we should update the user invite.
      await this.chatParticipantsService.updateParticipantByID(target.id, {
        owner: target.owner,
        operator: target.operator,
        banned: target.banned,
        mutedUntil: target.mutedUntil,
        invitedUntil: inviteUntil,
      });
    }
    else if (!target) { // Target in not in chan => has not been invited yet
      target = await this.chatsService.inviteParticipantToChatByUsername(
        chatRoomName,
        targetUsername,
        inviteUntil,
      );
    }
    return inviteUntil;
  }

  private async acceptUserInvite(chatRoomName: string, username: string) {
    try {
      const user = await this.getParticipant(chatRoomName, username);
      await this.checkUserIsNotBanned(user);
      await this.checkUserHasNotAlreadyAcceptedInvite(user);
      await this.checkUserInviteHasNotExpired(user);

      // if participant is currently invited (invite has not expired), set invited timestamp to 0
      // to indicate the invite was accepted
      await this.chatParticipantsService.updateParticipantByID(
        user.id,
        {
          operator: user.operator,
          owner: user.owner,
          banned: user.banned,
          mutedUntil: user.mutedUntil,
          invitedUntil: 0,
        },
      );
    }
    catch (e) {
      // if participant is not currently invited and is trying to accept an invite, delete
      // participant from channel so participant can be invited again.
      await this.chatParticipantsService.deleteParticipantInChatByUsername(
        username,
        chatRoomName,
      );
      // And pass along the error we encountered.
      throw new ChatPermissionError(e.message);
    }
  }
}