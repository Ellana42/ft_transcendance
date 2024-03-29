import { useContext, useEffect, useState } from "react";
import { AuthenticationContext } from "../authenticationState";
import { AiOutlineClose, AiOutlineMenu } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import { useCookies } from "react-cookie";
import { logoutUser } from "../logout/logout";
import { IoSearchSharp, IoSunnyOutline } from "react-icons/io5";
import { FaRegMoon } from "react-icons/fa6";
import { isDarkModeEnabled } from "../../cookies";
import { useWebSocket } from "../../contexts/WebsocketContext";

function Navbar() {
	const { authenticatedUserID, setAuthenticatedUserID } = useContext(
		AuthenticationContext
	);
	const [cookies, setCookie, removeCookie] = useCookies(["token", "darkmode"]);
	const [nav, setNav] = useState(false);
	const socket = useWebSocket();
	const navigate = useNavigate();
	const handleNav = () => {
		setNav(!nav);
	};

	useEffect(() => {
		if (socket) {
			socket.on("logout", () => {
				logoutUser(
					socket,
					cookies,
					setAuthenticatedUserID,
					removeCookie,
					navigate
				);
			});
			return () => {
				socket.off("logout");
			};
		}
	}, [cookies, navigate, removeCookie, setAuthenticatedUserID, socket]);

	function toggleDarkModeCookie() {
		if (isDarkModeEnabled(cookies)) {
			setCookie("darkmode", "false", { path: "/" });
		} else {
			setCookie("darkmode", "true", { path: "/" });
		}
	}

	return (
		<div className="navbar flex justify-between items-center text-sage dark:text-darkdarkblue bg-teal dark:bg-darkteal">
			<h1 className={"w-full text-lg lg:text-3xl font-bold"}>
				ft_transcendance
			</h1>
			<div onClick={toggleDarkModeCookie}>
				{isDarkModeEnabled(cookies) ? (
					<IoSunnyOutline className="w-6 h-6 m-2" />
				) : (
					<FaRegMoon className="w-6 h-6 m-2" />
				)}
			</div>
			<div>
				<a href="/search">
					<IoSearchSharp className="w-6 h-6 m-2" />
				</a>
			</div>

			<ul className="hidden md:flex font-mono">
				<li className="navlink">
					<a href="/">Home</a>
				</li>
				<li className="navlink">
					<a href="/leaderboard">Leaderboard</a>
				</li>
				{authenticatedUserID && (
					<>
						<li className="navlink">
							<a href="/chat">Chat</a>
						</li>
						<li className="navlink">
							<a href="/play"> Play</a>
						</li>
						<li className="navlink">
							<a href={"/user/" + authenticatedUserID}>Profile</a>
						</li>
						<li className="navlink">
							<a href="/logout">Logout</a>
						</li>
					</>
				)}
				{!authenticatedUserID && (
					<>
						<form action="/backend/auth/42login">
							<button className="bg-darkblue font-bold dark:bg-darkdarkblue dark:text-darksage rounded-md m-2 p-2 px-4 whitespace-nowrap">
								Login with 42
							</button>
						</form>
					</>
				)}
			</ul>
			<div
				onClick={handleNav}
				className={`block ${nav ? "" : "md:hidden"} z-30`}
			>
				{nav ? <AiOutlineClose size={20} /> : <AiOutlineMenu size={20} />}
			</div>
			<ul
				className={
					nav
						? "fixed left-0 top-16 right-0 w-[60%] h-full bg-teal dark:bg-darkteal ease-in-out duration-500"
						: "ease-in-out duration-500 fixed top-16 h-full left-[-100%]"
				}
			>
				<li className="navlink-extended">
					<a href="/">Home</a>
				</li>
				<li className="navlink-extended">
					<a href="/leaderboard">Leaderboard</a>
				</li>
				{authenticatedUserID && (
					<>
						<li className="navlink-extended">
							<a href="/chat">Chat</a>
						</li>
						<li className="navlink-extended">
							<a href="/play">Play</a>
						</li>
						<li className="navlink-extended">
							<a href={"/user/" + authenticatedUserID}>Profile</a>
						</li>
						<li className="navlink-extended">
							<a href="/search">Search</a>
						</li>
						<li className="navlink-extended">
							<a href="/logout">Logout</a>
						</li>
					</>
				)}
				{!authenticatedUserID && (
					<>
						<form
							action="/backend/auth/42login"
							className="navlink-extended bg-darkblue text-sage dark:bg-darkdarkblue dark:text-darksage font-bold"
						>
							<button>Login with 42</button>
						</form>
					</>
				)}
			</ul>
		</div>
	);
}
export default Navbar;
