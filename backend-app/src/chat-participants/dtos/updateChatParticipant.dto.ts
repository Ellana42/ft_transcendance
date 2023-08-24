import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber } from 'class-validator';

export class updateParticipantDto {
  @ApiProperty()
  @IsBoolean()
  owner?: boolean;

  @ApiProperty()
  @IsBoolean()
  operator?: boolean;

  @ApiProperty()
  @IsBoolean()
  banned?: boolean;

  @ApiProperty()
  @IsNumber()
  mutedUntil?: number;
}
