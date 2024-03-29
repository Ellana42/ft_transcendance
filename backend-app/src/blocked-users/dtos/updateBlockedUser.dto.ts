import {ApiProperty} from '@nestjs/swagger';
import {IsInt, IsNotEmpty, IsPositive} from 'class-validator';

export class updateBlockedUserDto {
	@ApiProperty()
	@IsNotEmpty()
	@IsInt()
	@IsPositive()
	blockingUserID: number;

	@ApiProperty()
	@IsNotEmpty()
	@IsInt()
	@IsPositive()
	blockedUserID: number;
}
