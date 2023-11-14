import { OnModuleInit, Inject, forwardRef } from "@nestjs/common";
import {
	ConnectedSocket,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import { Server } from "socket.io";
import { GamesService } from "src/games/games.service";
import { AuthService } from "src/auth/auth.service";
import { Socket } from "socket.io";
import { MessageBody } from "@nestjs/websockets";
import { ChatGateway } from "./chat.gateway";
import { createGameParams } from "src/games/utils/types";
import { userStatus } from "src/users/entities/user.entity";
import { UsersService } from "src/users/users.service";
import { UserNotFoundError } from "src/exceptions/not-found.interceptor";
import { InvitesService } from "src/invites/invites.service";
import { NotFoundError } from "rxjs";

const WINNING_SCORE = 2;

type Player = {
	userID: number;
	username: string;
	socket?: Socket;
	inviteID?: number;
};

type Position = {
	x: number;
	y: number;
};

type Step = {
	stepX: number;
	stepY: number;
};

type State = {
	result: number[];
	p1: number;
	p2: number;
	live: boolean;
	isPaused: boolean;
	ballPosition: Position;
	move: Step;
};

type GameRoom = {
	player1: Player;
	player2: Player;
	socketRoomID: string;
	gameState: State;
	// interval: NodeJS.Timer;
	interval: NodeJS.Timeout;
};

type PlayerInfo = {
	userID: number;
	username: string;
};

type GameInfo = {
	player1: PlayerInfo;
	player2: PlayerInfo;
	socketRoomID: string;
};

@WebSocketGateway({
	cors: {
		origin: ["http://localhost:3000", "http://localhost"],
	},
})
export class GameGateway implements OnModuleInit {
	constructor(
		@Inject(forwardRef(() => AuthService))
		private authService: AuthService,
		@Inject(forwardRef(() => GamesService))
		private gameService: GamesService,
		@Inject(forwardRef(() => UsersService))
		private usersService: UsersService,
		@Inject(forwardRef(() => InvitesService))
		private invitesService: InvitesService,
		@Inject(forwardRef(() => ChatGateway))
		private chatGateway: ChatGateway
	) {}
	@WebSocketServer()
	server: Server;
	delay: number;
	player1x: number;
	player2x: number;
	pHeight: number;
	gateHeight: number;
	gateY: number;
	p1GateX: number;
	p2GateX: number;
	playerMaxY: number;
	playerMinY: number;
	ballRadius: number;
	bottomBoundary: number;
	topBoundary: number;
	leftBoundary: number;
	rightBoundary: number;
	step: number;
	gameRooms: GameRoom[];
	waitList: Player[];
	gameRoomID: number;

	onModuleInit() {
		this.delay = 6;
		this.player1x = 42;
		this.player2x = 660;
		this.pHeight = 80;
		this.gateHeight = 160;
		this.gateY = 100;
		this.p1GateX = 3;
		this.p2GateX = 697;
		this.playerMaxY = 400;
		this.playerMinY = 0;
		this.ballRadius = 10;
		this.bottomBoundary = 410;
		this.topBoundary = 10;
		this.leftBoundary = 5;
		this.rightBoundary = 710;
		this.step = 7;
		this.gameRooms = [];
		this.waitList = [];
		this.gameRoomID = 0;
		this.server.on("connection", async (socket) => {
			const token = socket.handshake.headers.authorization.split(" ")[1];
			const user = await this.authService
				.validateToken(token)
				.catch(() => {
					return false;
				})
				.finally(() => {
					return true;
				});

			console.log(
				`[Game Gateway]: A user connected: ${user.username} - ${user.userID} (${socket.id})`
			);
			socket.broadcast.emit("connection event"); // TODO: probably remove
			if (await this.reconnect(socket, user.userID)) {
				console.log(
					`[Game Gateway]: A user rejoined: ${user.username} a game)`
				);
				socket.emit("rejoin game");
			}
			socket.on("disconnect", () => {
				console.log(
					`[Game Gateway]: A user disconnected: ${user.username} - ${user.userID} (${socket.id})`
				);
				socket.broadcast.emit("disconnection event");
			});
		});
	}

	private startGame(gameRoom: GameRoom) {
		console.log("[Game Gateway]: Game started");
		// TODO: send to everybody everywhere that the game started
		this.server.to(gameRoom.socketRoomID).emit("start game");
		this.randomInitialMove(gameRoom.gameState);

		gameRoom.interval = setInterval(() => {
			this.tick(gameRoom);
			this.server.to(gameRoom.socketRoomID).emit("tick", gameRoom);
		}, this.delay);
	}

	private async stopGame(gameRoom: GameRoom) {
		console.log("[Game Gateway]: Game stopped");
		// TODO: send to everybody everywhere that the game is done
		await this.updatePlayerStatus(userStatus.ONLINE, gameRoom.player1.userID);
		await this.updatePlayerStatus(userStatus.ONLINE, gameRoom.player2.userID);
		clearInterval(gameRoom.interval);
		this.server.in(gameRoom.socketRoomID).socketsLeave(gameRoom.socketRoomID);
		this.gameRooms = this.gameRooms.filter(
			(gr: GameRoom) => gr.socketRoomID !== gameRoom.socketRoomID
		);
	}

	private async getRoom(userID: number) {
		for (let i = this.gameRooms.length - 1; i >= 0; i--) {
			const gameRoom = this.gameRooms[i];
			if (
				gameRoom.player1.userID === userID ||
				gameRoom.player2.userID === userID
			) {
				return gameRoom;
			}
		}
		return null;
	}

	private async updatePlayerStatus(status: userStatus, userID: number) {
		await this.usersService.updateUserByID(userID, { status: status });
	}

	private placeBall() {
		return { x: 250, y: 250 };
	}

	private createGameState() {
		return {
			result: [0, 0],
			p1: 160,
			p2: 160,
			live: true,
			isPaused: false,
			ballPosition: this.placeBall(),
			move: {
				stepX: -1,
				stepY: 1,
			},
		};
	}

	private async reconnect(socket: Socket, userID: number) {
		const myGameRoom: GameRoom = await this.getRoom(userID);
		if (myGameRoom) {
			await socket.join(myGameRoom.socketRoomID);
			console.log(
				"[Game Gateway]:",
				"Setting up user",
				userID,
				"to join back gameroom",
				myGameRoom.socketRoomID
			);
			return true;
		}
		return false;
	}

	private async createRoom(
		player1: Player,
		player2: Player
	): Promise<GameRoom> {
		const socketRoomID = this.gameRoomID.toString();
		this.gameRoomID++;

		console.log(
			"[Game Gateway]: Create new GameRoom of id",
			socketRoomID,
			"with player1",
			player1.userID,
			"of username",
			player1.username,
			"and player2",
			player2.userID,
			"of username",
			player2.username
		);
		await player1.socket.join(socketRoomID);
		await player2.socket.join(socketRoomID);
		delete player1.socket;
		delete player2.socket;
		await this.updatePlayerStatus(userStatus.INGAME, player1.userID);
		await this.updatePlayerStatus(userStatus.INGAME, player2.userID);
		const gameRoom: GameRoom = {
			player1: player1,
			player2: player2,
			socketRoomID: socketRoomID,
			gameState: this.createGameState(),
			interval: null,
		};
		this.gameRooms.push(gameRoom);
		return gameRoom;
	}

	private getFreePlayer(): Player {
		for (let i = 0; i < this.waitList.length; i++) {
			const player = this.waitList[i];
			if (!player.inviteID) {
				return player;
			}
		}
		return null;
	}

	private getInvitedPlayer(player: Player): Player {
		for (let i = 0; i < this.waitList.length; i++) {
			const opponent = this.waitList[i];
			if (opponent.inviteID === player.inviteID) {
				console.log(
					"[Game Gateway]: Found opponent",
					opponent.username,
					"with invite",
					opponent.inviteID,
					"for player",
					player.username,
					"with invite",
					player.inviteID
				);
				return opponent;
			}
		}
		return null;
	}

	private async waitForOpponent(player: Player) {
		let opponent: Player;
		if (player.inviteID) {
			opponent = this.getInvitedPlayer(player);
		} else {
			opponent = this.getFreePlayer();
		}
		if (opponent) {
			console.log(
				"[Game Gateway]: Found opponent",
				opponent.username,
				"with invite",
				opponent.inviteID
			);
			return this.createRoom(player, opponent);
		}
		console.log(
			"[Game Gateway]: Did not found opponent for",
			player.username,
			"with invite",
			player.inviteID
		);
		this.waitList.push(player);
		return null;
	}

	randomInitialMove(gameState: State) {
		// pseudo-random ball behavior
		const moves = [
			{ stepX: 1, stepY: 1 },
			{ stepX: 1, stepY: 2 },
			{ stepX: 2, stepY: 1 },
			{ stepX: -1, stepY: -1 },
			{ stepX: -1, stepY: 1 },
		];
		const initialMove = moves[Math.floor(Math.random() * moves.length)];
		gameState.move = initialMove;
	}

	checkGoals(gameState: State) {
		//checking if the ball touches the borders of the goal
		if (
			gameState.ballPosition.x - this.ballRadius <=
				this.p1GateX + this.ballRadius * 2 &&
			gameState.ballPosition.y + this.ballRadius >= this.gateY &&
			gameState.ballPosition.y - this.ballRadius <= this.gateY + this.gateHeight
		) {
			gameState.result = [gameState.result[0], gameState.result[1] + 1];
			this.resetBall(gameState);
			this.randomInitialMove(gameState);
		}

		if (
			gameState.ballPosition.x + this.ballRadius >= this.p2GateX &&
			gameState.ballPosition.y + this.ballRadius >= this.gateY &&
			gameState.ballPosition.y - this.ballRadius <= this.gateY + this.gateHeight
		) {
			gameState.result = [gameState.result[0] + 1, gameState.result[1]];
			this.resetBall(gameState);
			this.randomInitialMove(gameState);
		}
	}

	checkPlayers(gameState: State) {
		//checking if the ball is touching the players, and if so, calculating the angle of rebound
		if (
			gameState.ballPosition.x - this.ballRadius <= this.player1x &&
			gameState.ballPosition.y + this.ballRadius >= gameState.p1 &&
			gameState.ballPosition.y - this.ballRadius <= gameState.p1 + this.pHeight
		) {
			gameState.move = {
				stepX: -gameState.move.stepX,
				stepY: gameState.move.stepY,
			};
		}

		if (
			gameState.ballPosition.x - this.ballRadius >= this.player2x &&
			gameState.ballPosition.y + this.ballRadius >= gameState.p2 &&
			gameState.ballPosition.y - this.ballRadius <= gameState.p2 + this.pHeight
		) {
			gameState.move = {
				stepX: -gameState.move.stepX,
				stepY: gameState.move.stepY,
			};
		}
	}

	checkBallBoundaries(gameState: State) {
		//checking if the ball is touching the boundaries, and if so, calculating the angle of rebound
		if (
			gameState.ballPosition.y + this.ballRadius + gameState.move.stepY >=
				this.bottomBoundary ||
			gameState.ballPosition.y - this.ballRadius + gameState.move.stepY <=
				this.topBoundary
		) {
			gameState.move = {
				stepX: gameState.move.stepX,
				stepY: -gameState.move.stepY,
			};
		}

		if (
			gameState.ballPosition.x - this.ballRadius + gameState.move.stepX <=
				this.leftBoundary ||
			gameState.ballPosition.x + this.ballRadius + gameState.move.stepX >=
				this.rightBoundary
		) {
			gameState.move = {
				stepX: -gameState.move.stepX,
				stepY: gameState.move.stepY,
			};
		}
	}

	check(gameRoom: GameRoom) {
		this.checkPlayers(gameRoom.gameState);
		this.checkGoals(gameRoom.gameState);
		this.checkBallBoundaries(gameRoom.gameState);
		this.checkGameOver(gameRoom);
	}

	tick(gameRoom: GameRoom) {
		if (gameRoom.gameState.live === true) {
			gameRoom.gameState.ballPosition = {
				x: gameRoom.gameState.ballPosition.x + gameRoom.gameState.move.stepX,
				y: gameRoom.gameState.ballPosition.y + gameRoom.gameState.move.stepY,
			};
		}
		this.check(gameRoom);
	}

	checkPlayerBoundaries(
		player: number, //checking the boundaries of players for going beyond the field
		gameState: State
	) {
		if (player === 1) {
			if (gameState.p1 + this.pHeight >= this.playerMaxY) return 1;
			if (gameState.p1 <= this.playerMinY) {
				return 2;
			}
		} else if (player === 2) {
			if (gameState.p2 + this.pHeight >= this.playerMaxY) return 3;
			if (gameState.p2 <= this.playerMinY) return 4;
		}

		return 0;
	}

	resetPlayer(
		code: number, //return of players to the field, in case of exit
		gameState: State
	) {
		if (code === 1) {
			gameState.p1 = this.playerMaxY - this.pHeight;
		}
		if (code === 2) {
			gameState.p1 = this.playerMinY;
		}
		if (code === 3) {
			gameState.p2 = this.playerMaxY - this.pHeight;
		}
		if (code === 4) {
			gameState.p2 = this.playerMinY;
		}
	}

	resetBall(gameState: State) {
		gameState.ballPosition = this.placeBall();
	}

	restart(gameState: State) {
		this.resetBall(gameState);
		this.randomInitialMove(gameState);
	}

	pause(gameState: State) {
		gameState.live = !gameState.live;
		gameState.isPaused = !gameState.isPaused;
	}

	checkGameOver(gameRoom: GameRoom) {
		if (
			(gameRoom.gameState.result[0] === WINNING_SCORE ||
				gameRoom.gameState.result[1] === WINNING_SCORE) &&
			!gameRoom.gameState.isPaused
		) {
			this.pause(gameRoom.gameState);
			console.log("[Game Gateway]: a player won !");

			let gameDetails: createGameParams;
			// TODO: maybe move to another function
			if (gameRoom.gameState.result[0] === WINNING_SCORE) {
				gameDetails = {
					winnerID: gameRoom.player1.userID,
					loserID: gameRoom.player2.userID,
					loserScore: gameRoom.gameState.result[1],
					winnerScore: WINNING_SCORE,
				};
			} else {
				gameDetails = {
					winnerID: gameRoom.player2.userID,
					loserID: gameRoom.player1.userID,
					loserScore: gameRoom.gameState.result[0],
					winnerScore: WINNING_SCORE,
				};
			}

			this.server.to(gameRoom.socketRoomID).emit("end game", gameDetails);
			this.gameService.createGame(gameDetails);
			this.stopGame(gameRoom);
		}
	}

	@SubscribeMessage("up")
	async onUp(@ConnectedSocket() socket: Socket, @MessageBody() token: string) {
		const userID: number = await this.chatGateway.checkIdentity(token, socket);
		const user = await this.usersService.fetchUserByID(userID);
		if (!user) {
			throw new UserNotFoundError();
		}

		const gameRoom: GameRoom = await this.getRoom(userID);

		let playerIndex = 1;
		if (gameRoom.player1.userID === userID) {
			gameRoom.gameState.p1 -= this.step;
		} else {
			playerIndex = 2;
			gameRoom.gameState.p2 -= this.step;
		}

		if (this.checkPlayerBoundaries(playerIndex, gameRoom.gameState)) {
			this.resetPlayer(
				this.checkPlayerBoundaries(playerIndex, gameRoom.gameState),
				gameRoom.gameState
			);
		}
	}

	@SubscribeMessage("down")
	async onDown(
		@ConnectedSocket() socket: Socket,
		@MessageBody() token: string
	) {
		const userID: number = await this.chatGateway.checkIdentity(token, socket);
		const user = await this.usersService.fetchUserByID(userID);
		if (!user) {
			throw new UserNotFoundError();
		}
		const gameRoom: GameRoom = await this.getRoom(userID);

		let playerIndex = 1;
		if (gameRoom.player1.userID === userID) {
			gameRoom.gameState.p1 += this.step;
		} else {
			playerIndex = 2;
			gameRoom.gameState.p2 += this.step;
		}
		if (this.checkPlayerBoundaries(playerIndex, gameRoom.gameState)) {
			this.resetPlayer(
				this.checkPlayerBoundaries(playerIndex, gameRoom.gameState),
				gameRoom.gameState
			);
		}
	}

	@SubscribeMessage("waiting")
	async onWaiting(
		@ConnectedSocket() socket: Socket,
		@MessageBody() info: { token: string; inviteID: number }
	) {
		const token = info.token;
		const inviteID = info.inviteID;

		const userID: number = await this.chatGateway.checkIdentity(token, socket);
		const user = await this.usersService.fetchUserByID(userID);
		const invitation = await this.invitesService.fetchInviteByID(inviteID);
		if (!user) {
			throw new UserNotFoundError();
		}
		if (!invitation) {
			throw new NotFoundError("Invite not found");
		}

		if (await this.reconnect(socket, user.id)) {
			return;
		}
		const player: Player = {
			userID: user.id,
			username: user.username,
			socket: socket,
		};
		if (inviteID) {
			player.inviteID = inviteID;
		}
		const myGameRoom: GameRoom = await this.waitForOpponent(player);
		if (!myGameRoom) {
			console.log(
				`[Game Gateway]: ${player.username} is waiting for an opponent:`,
				player
			);
		} else {
			this.startGame(myGameRoom);
		}
	}

	@SubscribeMessage("leave game")
	async onLeaveGame(
		@ConnectedSocket() socket: Socket,
		@MessageBody() token: string
	) {
		const userID: number = await this.chatGateway.checkIdentity(token, socket);
		const user = await this.usersService.fetchUserByID(userID);
		if (!user) {
			throw new UserNotFoundError();
		}
		const gameRoom: GameRoom = await this.getRoom(userID);

		this.server.to(gameRoom.socketRoomID).emit("leave game", userID);
		await this.stopGame(gameRoom);
	}

	gameToGameInfo(game: GameRoom): GameInfo {
		const gameInfo: GameInfo = {
			player1: {
				userID: game.player1.userID,
				username: game.player1.username,
			},
			player2: {
				userID: game.player2.userID,
				username: game.player2.username,
			},
			socketRoomID: game.socketRoomID,
		};
		return gameInfo;
	}

	@SubscribeMessage("get games")
	async onGetGames(
		@ConnectedSocket() socket: Socket,
		@MessageBody() token: string
	) {
		const userID: number = await this.chatGateway.checkIdentity(token, socket);
		const user = await this.usersService.fetchUserByID(userID);
		if (!user) {
			throw new UserNotFoundError();
		}
		socket.emit("get games", this.gameRooms.map(this.gameToGameInfo));
	}
}
