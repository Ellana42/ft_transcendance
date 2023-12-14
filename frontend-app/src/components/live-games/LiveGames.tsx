import { linkToGame } from "../profile/friendsList";
import { GameInfo } from "../play/play";

function displayLiveGame(game: GameInfo) {
	return (
		<tr className="border-b-2 border-lightblue hover:bg-teal hover:text-sage">
			<td className="p-2 text-center font-bold border-r-2 border-lightblue border-dashed">
				<a href={`/user/${game.player1.userID}`}>{game.player1.username}</a>
			</td>
			<td className="p-2 text-center font-bold border-r-2 border-lightblue border-dashed">
				<a href={`/user/${game.player2.userID}`}>{game.player2.username}</a>
			</td>
			<td className="flex p-2 justify-center">{linkToGame(game)}</td>
		</tr>
	);
}

function displayLiveGames(games: GameInfo[]) {
	return games.map(displayLiveGame);
}

function LiveGames(gameInfos: GameInfo[]) {
	return (
		<div className="background-element">
			<h1 className="title-element">Games currently live !</h1>
			<div className="rounded-md overflow-hidden">
				<table className="table-auto w-full bg-sage">
					<tr className="font-bold text-sage bg-darkblue">
						<td className="p-2 text-center">Player 1</td>
						<td className="p-2 text-center">Player 2</td>
						<td className="p-2 text-center">Watch Game</td>
					</tr>
					{displayLiveGames(gameInfos)}
				</table>
			</div>
		</div>
	);
}

export default LiveGames;
