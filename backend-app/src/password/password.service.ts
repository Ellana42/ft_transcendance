import { Inject, Injectable, forwardRef, Logger } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { ChatsService } from "src/chats/chats.service";
import { ChatEntity } from "src/chats/entities/chat.entity";
import { UserEntity } from "src/users/entities/user.entity";
import { UsersService } from "src/users/users.service";

@Injectable()
export class PasswordService {
	constructor(
		@Inject(forwardRef(() => UsersService))
		private userService: UsersService,
		@Inject(forwardRef(() => ChatsService))
		private chatService: ChatsService
	) {}

	async hashPassword(password: string) {
		if (!password || password === "") {
			return password;
		}
		const salt = await bcrypt.genSalt();
		const hash = await bcrypt.hash(password, salt);
		return hash;
	}

	async checkPassword(password: string, user: UserEntity) {
		const hash = await this.userService.getUserPasswordHash(user.id);
		const isMatch = await bcrypt.compare(password, hash);
		return isMatch;
	}

	async checkPasswordChat(
		password: string,
		chat: ChatEntity
	): Promise<boolean> {
		const hash = await this.chatService.getChatRoomPasswordHash(chat.id);
		if (hash === "" || hash === null || hash === undefined) {
			return true;
		}
		if (password == null || password == undefined) {
			return false;
		}
		const isMatch = await bcrypt.compare(password, hash);
		return isMatch;
	}

	async checkPasswordString(password: string, hash: string) {
		const isMatch = await bcrypt.compare(password, hash);
		return isMatch;
	}
}
