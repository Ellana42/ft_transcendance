import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'games' })
export class gameEntity {
    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    winner: string;
    @Column()
    loser: string;
    @Column()
    winnerScore: number;
    @Column()
    loserScore: number;
    @Column()
    createdAt: Date;
}