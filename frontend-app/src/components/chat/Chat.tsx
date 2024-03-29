import {
	ReactElement,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { useCookies } from "react-cookie";
import { useNavigate, useParams } from "react-router-dom";
import Messages, { inviteMessage } from "./Messages";
import SettingsMenu from "./SettingsMenu";
import SidePannel from "./SidePannel";
import SendForm from "./SendForm";
import { Socket } from "socket.io-client";
import { getUsername } from "../../cookies";
import {
	Status,
	Message,
	User,
	ChatRoom,
	Invite,
	ReceivedInfo,
	PublicChatRoom,
	typeInvite,
} from "./types";
import { AuthenticationContext } from "../authenticationState";
import { formatDate, getFormattedTime } from "../styles/dateFormat";
import { BannerType, createBanner } from "../banner/Banner";
import {
	MdOutlineKeyboardDoubleArrowLeft,
	MdOutlineKeyboardDoubleArrowRight,
} from "react-icons/md";
import { useWindowSize } from "@uidotdev/usehooks";
import { useWebSocket } from "../../contexts/WebsocketContext";
import ContextMenuEl from "./ContextMenu";

export function isInChannel(
	userID: number,
	chatRoomID: number,
	chatRooms: ChatRoom[]
): boolean {
	return chatRooms
		.find((chatRoom) => chatRoom.chatRoomID === chatRoomID)
		.participants.some((user) => user.userID === userID);
}

export function checkStatus(channel: ChatRoom, userID: number): Status {
	if (!channel) return Status.Normal;
	var user = channel.participants.find((p) => p.userID === userID);
	if (!user) return Status.Normal;
	if (user.isOwner) return Status.Owner;
	if (user.isOperator) return Status.Operator;
	return Status.Normal;
}

export function isUserMuted(user: User): boolean {
	if (user.mutedUntil < new Date().getTime()) return false;
	return true;
}

export function isMuted(channel: ChatRoom, userID: number): boolean {
	var user = channel.participants.find((p) => p.userID === userID);
	if (!user) return false;
	if (user.mutedUntil < new Date().getTime()) {
		return false;
	}
	return true;
}

export function ChangeStatus(
	info: ReceivedInfo,
	userStatus: string,
	socket: Socket
) {
	const status_values = ["mute", "kick", "ban", "operator", "invite", "dm"];
	if (!status_values.includes(userStatus)) return;
	socket.emit(userStatus, info);
}

export function getChatRoomNameFromID(
	chatRoomID: number,
	channels: ChatRoom[]
) {
	return channels.find((chatRoom: ChatRoom) => {
		return chatRoomID === chatRoom.chatRoomID;
	}).name;
}
export function getChatRoomIDFromName(
	chatRoomName: string,
	channels: ChatRoom[]
) {
	return channels.find((chatRoom: ChatRoom) => {
		return chatRoom.name === chatRoomName;
	}).chatRoomID;
}

export async function fetchChatData(
	chatRoomID: number,
	chatRoomName: string,
	isPrivate: boolean,
	isDirectMessage: boolean,
	request: any
): Promise<ChatRoom> {
	const participant_list = await fetchChatParticipants(chatRoomID, request);
	const message_list = await fetchChatMessages(chatRoomID, request);
	const hasPassword = await fetchHasPassword(chatRoomID, request);
	var chan: ChatRoom = {
		chatRoomID: chatRoomID,
		name: chatRoomName,
		isPrivate: isPrivate,
		ownerID: isDirectMessage
			? null
			: participant_list.find((u: User) => u.isOwner).userID,
		participants: participant_list.filter(
			(user: User) => !user.isBanned && user.invitedUntil === null
		),
		banned: participant_list.filter((user: User) => user.isBanned),
		invited: participant_list.filter(
			(user: User) => user.invitedUntil !== null
		),
		isDM: isDirectMessage,
		messages: message_list,
		hasPassword: hasPassword,
	};
	return chan;
}
export async function fetchChatParticipants(
	chatRoomID: number,
	request: any
): Promise<User[]> {
	var participant_list = await fetch(
		`/backend/chats/${chatRoomID}/participants`,
		request
	).then(async (response) => {
		const participant_data = await response.json();
		if (!response.ok) {
			console.warn("error response load participants");
			return null;
		}
		var participants = participant_data.map((user: any) => {
			var newUser: User = {
				isInChatRoom: true,
				userID: user.userID,
				username: user.username,
				isOwner: user.isOwner,
				isOperator: user.isOperator,
				isBanned: user.isBanned,
				mutedUntil: user.mutedUntil,
				invitedUntil: null,
			};
			return newUser;
		});
		return participants;
	});
	return participant_list;
}

export async function fetchChatMessages(
	chatRoomID: number,
	request: any
): Promise<Message[]> {
	var message_list = await fetch(
		`/backend/chats/${chatRoomID}/messages`,
		request
	).then(async (response) => {
		const message_data = await response.json();
		if (!response.ok) {
			console.warn("error response load messages");
			return null;
		}
		var messages = message_data.map((message: any) => {
			var newMessage: Message = {
				datestamp: message.sentAt,
				msg: message.message,
				senderID: message.senderID,
				senderUsername: message.senderUsername,
				chatRoomID: message.chatRoomID,
				read: true,
				system: false,
			};
			return newMessage;
		});
		return messages;
	});
	return message_list;
}

export async function fetchHasPassword(
	chatRoomID: number,
	request: any
): Promise<boolean> {
	return await fetch(`/backend/chats/${chatRoomID}/has_password`, request).then(
		async (response) => {
			const hasPassword = await response.json();
			if (!response.ok) {
				console.warn("error response load has password");
				return null;
			}
			return hasPassword;
		}
	);
}

export type CurrentPannel = { type: PannelType; chatRoomID?: number };

export enum PannelType {
	home = "home",
	chat = "chat",
	invite = "invite",
	publicChats = "publicChats",
}

export type Position = { x: number; y: number };

export const Chat = ({ setBanners }) => {
	const socket = useWebSocket();
	const [myChats, setMyChats] = useState<ChatRoom[]>([]);
	const [publicChats, setPublicChats] = useState<PublicChatRoom[]>([]);
	const [newchannel, setNewchannel] = useState("");
	const [settings, setSettings] = useState(false);
	const [cookies] = useCookies(["token"]);
	const [contextMenu, setContextMenu] = useState(false);
	const [contextMenuPos, setContextMenuPos] = useState<Position>({
		x: 0,
		y: 0,
	});
	const [contextMenuTarget, setContextMenuTarget] = useState<User>(null);
	const [currentPannel, setCurrentPannel] = useState<CurrentPannel>({
		type: PannelType.home,
	});
	const [blockedUsers, setBlockedUsers] = useState([]);
	const [invites, setInvites] = useState([]);
	const [redirected, setRedirected] = useState<boolean>(false);
	const { authenticatedUserID } = useContext(AuthenticationContext);
	const [sidePannel, setSidePannel] = useState<boolean>(true);
	const [notifMessage, setNotifMessage] = useState<ReactElement>(<></>);
	const [shouldShowBanner, setShouldShowBanner] = useState<boolean>(false);
	const windowSize = useWindowSize();

	var urlUserID: string = useParams().userID;
	let navigate = useNavigate();

	useEffect(() => {
		if (shouldShowBanner) {
			createBanner(notifMessage, setBanners);
		}
		setShouldShowBanner(true);
	}, [createBanner, notifMessage, setBanners]);

	const toggleSidePannel = () => {
		if (windowSize.width < 768) {
			setSettings(false);
		}
		setSidePannel(!sidePannel);
	};

	function getChannel(chatRoomID: number): ChatRoom {
		return myChats.find((e) => e.chatRoomID === chatRoomID);
	}

	const addMessageToChatRoom = useCallback(
		(message: Message, chatRoomID: number) => {
			setMyChats((prev) => {
				const temp = [...prev];
				return temp.map((chat: ChatRoom) => {
					if (chat.chatRoomID === chatRoomID) {
						if (
							message.senderID !== authenticatedUserID &&
							message.system === false
						) {
							const notifMessage: ReactElement = (
								<>
									<b>{message.senderUsername}</b>
									{chat.isDM ? (
										""
									) : (
										<>
											{" "}
											in <b>{chat.name}</b>
										</>
									)}{" "}
									: {message.msg.slice(0, 20)}...
								</>
							);
							setNotifMessage(notifMessage);
						}
						chat.messages = [...chat.messages, message];
					}
					return chat;
				});
			});
		},
		[authenticatedUserID, setBanners]
	);

	const serviceAnnouncement = useCallback(
		(content: string, chatRoomID: number) => {
			var message: Message = {
				msg: content,
				datestamp: new Date(),
				senderID: null,
				chatRoomID: chatRoomID,
				read: true,
				system: true,
				senderUsername: null,
			};
			addMessageToChatRoom(message, chatRoomID);
		},
		[addMessageToChatRoom]
	);

	useEffect(() => {
		if (!socket) {
			return;
		}
		var request = {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${cookies["token"]}`,
			},
		};
		socket.on("error", (error_msg: string) => {
			createBanner(error_msg, setBanners, BannerType.Alert);
		});

		socket.on("chat message", (info: ReceivedInfo) => {
			var message: Message = {
				datestamp: info.messageInfo.sentAt,
				msg: info.messageInfo.message,
				senderID: info.userID,
				chatRoomID: info.chatRoomID,
				read: false,
				system: false,
				senderUsername: info.username,
			};
			addMessageToChatRoom(message, info.chatRoomID);
		});

		socket.on("delete chat", (info: ReceivedInfo) => {
			setMyChats((prev) =>
				prev.filter((e: ChatRoom) => e.chatRoomID !== info.chatRoomID)
			);
			setPublicChats((prev) =>
				prev.filter((e: ChatRoom) => e.chatRoomID !== info.chatRoomID)
			);
			setSettings(false);
			setContextMenu(false);
			setCurrentPannel({ type: PannelType.home, chatRoomID: null });
		});

		socket.on("toggle private", async (info: ReceivedInfo) => {
			if (info.chatInfo.isPrivate) {
				// the chat is becoming private
				setPublicChats((prev) =>
					prev.filter((e: ChatRoom) => e.chatRoomID !== info.chatRoomID)
				);
			} else {
				// the chat is going public
				const newPublicChat: PublicChatRoom = {
					chatRoomID: info.chatRoomID,
					name: info.chatInfo.name,
					hasPassword: info.chatInfo.hasPassword,
				};

				setPublicChats((prev) => [...prev, newPublicChat]);
			}

			setMyChats((prev) => {
				const temp = [...prev];
				return temp.map((chat: ChatRoom) => {
					if (chat.chatRoomID === info.chatRoomID) {
						if (info.chatInfo.isPrivate) {
							chat.isPrivate = true;
							serviceAnnouncement(
								"This chatroom is now private",
								chat.chatRoomID
							);
						} else {
							chat.isPrivate = false;
							serviceAnnouncement(
								"This chatroom is now public",
								chat.chatRoomID
							);
						}
					}
					return chat;
				});
			});
		});

		socket.on("add chat", (info: ReceivedInfo) => {
			var publicChatRoom: PublicChatRoom = {
				chatRoomID: info.chatRoomID,
				name: info.chatInfo.name,
				hasPassword: info.chatInfo.hasPassword,
			};

			setPublicChats((prev) => [...prev, publicChatRoom]);

			if (info.userID === authenticatedUserID) {
				var user: User = {
					userID: info.userID,
					username: info.username,
					isOwner: true,
					isOperator: true,
					isBanned: false,
					mutedUntil: new Date().getTime(),
					invitedUntil: 0,
					isInChatRoom: true,
				};
				var chatRoom: ChatRoom = {
					chatRoomID: info.chatRoomID,
					name: info.chatInfo.name,
					participants: [user],
					banned: [],
					invited: [],
					messages: [],
					isPrivate: info.chatInfo.isPrivate,
					ownerID: info.userID,
					isDM: false,
					hasPassword: info.chatInfo.hasPassword,
				};
				setMyChats((prev) => [...prev, chatRoom]);
			}
		});

		socket.on("join chat", async (info: ReceivedInfo) => {
			var user: User = {
				isInChatRoom: true,
				userID: info.userID,
				username: info.username,
				isOwner: false,
				isOperator: false,
				isBanned: false,
				mutedUntil: new Date().getTime(),
				invitedUntil: 0,
			};

			// For everybody in the chat, update participants
			setMyChats((prev) => {
				const temp = [...prev];
				return temp.map((chat: ChatRoom) => {
					if (chat.chatRoomID === info.chatRoomID) {
						chat.participants = [...chat.participants, user];
						serviceAnnouncement(
							`${info.username} has joined the channel`,
							chat.chatRoomID
						);
					}
					return chat;
				});
			});

			if (info.userID === authenticatedUserID) {
				// If i'm the one joining create new mychat and fetch info
				const newChat = await fetchChatData(
					info.chatRoomID,
					info.chatInfo.name,
					info.chatInfo.isPrivate,
					false,
					request
				);
				setMyChats((prev) => [...prev, newChat]);
			}
		});

		socket.on("leave chat", (info: ReceivedInfo) => {
			// For everybody in the chat, update participants
			setMyChats((prev) => {
				const temp = [...prev];
				return temp.map((chat: ChatRoom) => {
					if (chat.chatRoomID === info.chatRoomID) {
						chat.participants = chat.participants.filter(
							(participant: User) => participant.userID !== info.userID
						);
						serviceAnnouncement(
							`${info.username} has left the channel`,
							chat.chatRoomID
						);
					}
					return chat;
				});
			});

			if (info.userID === authenticatedUserID) {
				// If i'm the one leaving remove chat from mychats
				setMyChats((prev) => {
					const tmp = [...prev];
					return tmp.filter(
						(chat: ChatRoom) => chat.chatRoomID !== info.chatRoomID
					);
				});
			}
		});

		socket.on("mute", (info: ReceivedInfo) => {
			setMyChats((prev) => {
				const temp = [...prev];
				return temp.map((chan: ChatRoom) => {
					if (chan.chatRoomID === info.chatRoomID) {
						if (info.targetID === authenticatedUserID) {
							let message: string;
							if (new Date(info.participantInfo.mutedUntil) > new Date()) {
								message = `You have been muted on ${
									chan.name
								} until ${getFormattedTime(
									new Date(info.participantInfo.mutedUntil)
								)}`;
							} else {
								message = `You have been unmuted on ${chan.name}`;
							}
							createBanner(message, setBanners);
						}
						chan.participants.map((p) => {
							if (p.userID === info.targetID) {
								p.mutedUntil = info.participantInfo.mutedUntil;
							}
							return p;
						});
					}
					return chan;
				});
			});
			if (new Date(info.participantInfo.mutedUntil) > new Date()) {
				serviceAnnouncement(
					`${info.username} has been muted until ${formatDate(
						new Date(info.participantInfo.mutedUntil)
					)} ${getFormattedTime(new Date(info.participantInfo.mutedUntil))}.`,
					info.chatRoomID
				);
			} else {
				serviceAnnouncement(
					`${info.username} has been unmuted.`,
					info.chatRoomID
				);
			}
		});

		socket.on("ban", (info: ReceivedInfo) => {
			// If somebody is being banned
			if (info.participantInfo.isBanned) {
				if (info.targetID === authenticatedUserID) {
					// If i'm the one being banned remove chat from mychats
					setMyChats((prev) => {
						const tmp = [...prev];
						return tmp.filter(
							(chat: ChatRoom) => chat.chatRoomID !== info.chatRoomID
						);
					});
					socket.emit("leave socket room", info);
					const message = `You have been banned from ${info.chatInfo.name}`;
					createBanner(message, setBanners, BannerType.Alert);
				}
				// For other people, move participant to banned list
				setMyChats((prev) => {
					const temp = [...prev];
					return temp.map((chat: ChatRoom) => {
						if (chat.chatRoomID === info.chatRoomID) {
							var banned_user = chat.participants.find(
								(p) => p.userID === info.targetID
							);
							banned_user.isBanned = true;
							chat.participants = chat.participants.filter(
								(p) => p.userID !== info.targetID
							);
							chat.banned = [...chat.banned, banned_user];
							serviceAnnouncement(
								`${info.username} has been banned from this channel.`,
								info.chatRoomID
							);
						}
						return chat;
					});
				});
			} else {
				// Somebody is being unbanned
				setMyChats((prev) => {
					const temp = [...prev];
					return temp.map((chat: ChatRoom) => {
						if (chat.chatRoomID === info.chatRoomID) {
							chat.banned = chat.banned.filter(
								(p) => p.userID !== info.targetID
							);
							if (info.targetID === authenticatedUserID) {
								const message = `You have been unbanned from ${info.chatInfo.name}`;
								createBanner(message, setBanners);
							}

							serviceAnnouncement(
								`${info.username} has been unbanned from this channel.`,
								info.chatRoomID
							);
						}
						return chat;
					});
				});
			}
		});

		socket.on("invite", (info: ReceivedInfo) => {
			// Receive invitation from someone else
			var invite: Invite = info.inviteInfo;
			if (
				invite.senderID === authenticatedUserID &&
				invite.type === typeInvite.Game
			) {
				navigate("/play/" + invite.id);
			}
			if (invite.invitedID === authenticatedUserID) {
				setInvites((prev: Invite[]) =>
					prev.filter((i: Invite) => i.id !== invite.id)
				);
				setInvites((prev: Invite[]) => [...prev, invite]);
				const message = (
					<>
						{invite.senderUsername} {inviteMessage(invite)}
					</>
				);
				createBanner(message, setBanners);
			}
		});

		socket.on("accept invite", async (info: ReceivedInfo) => {
			setInvites((prev) =>
				prev.filter((invite: Invite) => invite.id !== info.inviteInfo.id)
			);
			if (info.inviteInfo.type === typeInvite.Chat) {
				var user: User = {
					isInChatRoom: true,
					userID: info.userID,
					username: info.username,
					isOwner: false,
					isOperator: false,
					isBanned: false,
					mutedUntil: new Date().getTime(),
					invitedUntil: 0,
				};

				// For everybody in the chat, update participants
				setMyChats((prev) => {
					const temp = [...prev];
					return temp.map((chat: ChatRoom) => {
						if (chat.chatRoomID === info.chatRoomID) {
							chat.participants = [...chat.participants, user];
							serviceAnnouncement(
								`${info.username} has joined the channel`,
								chat.chatRoomID
							);
						}
						return chat;
					});
				});

				if (info.userID === authenticatedUserID) {
					// If i'm the one joining create new mychat and fetch info
					const newChat = await fetchChatData(
						info.chatRoomID,
						info.chatInfo.name,
						info.chatInfo.isPrivate,
						false,
						request
					);
					setMyChats((prev) => [...prev, newChat]);
				}
			} else if (info.inviteInfo.type === typeInvite.Game) {
				navigate("/play/" + info.inviteInfo.id);
			}
		});

		socket.on("refuse invite", (info: ReceivedInfo) => {
			setInvites((prev) =>
				prev.filter((invite: Invite) => invite.id !== info.inviteInfo.id)
			);
		});

		socket.on("set password", (info: ReceivedInfo) => {
			setPublicChats((prev: PublicChatRoom[]) => {
				const temp = [...prev];
				return temp.map((chat: PublicChatRoom) => {
					if (chat.chatRoomID === info.chatRoomID) {
						chat.hasPassword = info.chatInfo.hasPassword;
					}
					return chat;
				});
			});

			setInvites((prev: Invite[]) => {
				const temp = [...prev];
				return temp.map((invite: Invite) => {
					if (invite.chatRoomID === info.chatRoomID) {
						invite.chatHasPassword = info.chatInfo.hasPassword;
					}
					return invite;
				});
			});

			setMyChats((prev) => {
				const temp = [...prev];
				return temp.map((chat: ChatRoom) => {
					if (chat.chatRoomID === info.chatRoomID) {
						if (info.chatInfo.hasPassword) {
							chat.hasPassword = true;
							serviceAnnouncement(
								"This chatroom now has a password",
								chat.chatRoomID
							);
						} else {
							chat.hasPassword = false;
							serviceAnnouncement(
								"This chatroom doesn't have a password anymore",
								chat.chatRoomID
							);
						}
					}
					return chat;
				});
			});
		});

		socket.on("kick", (info: ReceivedInfo) => {
			// For everybody in the chat, update participants
			setMyChats((prev) => {
				const temp = [...prev];
				return temp.map((chat: ChatRoom) => {
					if (chat.chatRoomID === info.chatRoomID) {
						chat.participants = chat.participants.filter(
							(participant: User) => participant.userID !== info.targetID
						);
						serviceAnnouncement(
							`${info.username} has been kicked from the channel`,
							chat.chatRoomID
						);
					}
					return chat;
				});
			});

			if (info.targetID === authenticatedUserID) {
				// If i'm the one being kicked remove chat from mychats
				setMyChats((prev) => {
					const tmp = [...prev];
					return tmp.filter((chat: ChatRoom) => {
						if (chat.chatRoomID === info.chatRoomID) {
							const message = `You have been kicked from ${chat.name}`;
							createBanner(message, setBanners);
							return false;
						}
						return true;
					});
				});
				socket.emit("leave socket room", info);
			}
		});

		socket.on("operator", (info: ReceivedInfo) => {
			setMyChats((prev) => {
				const temp = [...prev];
				return temp.map((chan: ChatRoom) => {
					if (chan.chatRoomID === info.chatRoomID) {
						chan.participants.map((p: User) => {
							if (p.userID === info.targetID) {
								p.isOperator = info.participantInfo.isOperator;
								if (p.isOperator) {
									serviceAnnouncement(
										`${info.username} is now a channel admin.`,
										info.chatRoomID
									);
								} else {
									serviceAnnouncement(
										`${info.username} is not a channel admin anymore.`,
										info.chatRoomID
									);
								}
							}
							return p;
						});
					}
					return chan;
				});
			});
		});

		socket.on("dm", (info: ReceivedInfo) => {
			var user1: User = {
				isInChatRoom: true,
				userID: info.userID,
				username: info.username,
				isOwner: false,
				isOperator: false,
				isBanned: false,
				mutedUntil: new Date().getTime(),
				invitedUntil: null,
			};
			var user2: User = {
				isInChatRoom: true,
				userID: info.targetID,
				username: info.username2,
				isOwner: false,
				isOperator: false,
				isBanned: false,
				mutedUntil: new Date().getTime(),
				invitedUntil: null,
			};
			var channel: ChatRoom = {
				chatRoomID: info.chatRoomID,
				name: `DM: ${user1.username}/${user2.username}`,
				participants: [user1, user2],
				banned: [],
				invited: [],
				messages: [],
				isPrivate: true,
				ownerID: null,
				isDM: true,
				hasPassword: false,
			};
			socket.emit("join socket room", info);
			setMyChats((prev) => {
				if (prev.find((chan) => chan.chatRoomID === channel.chatRoomID)) {
					return [...prev];
				} else {
					return [...prev, channel];
				}
			});
		});

		return () => {
			socket.off("chat message");
			socket.off("error");
			socket.off("delete chat");
			socket.off("add chat");
			socket.off("join chat");
			socket.off("leave chat");
			socket.off("mute");
			socket.off("kick");
			socket.off("ban");
			socket.off("operator");
			socket.off("toggle private");
			socket.off("invite");
			socket.off("accept invite");
			socket.off("dm");
			socket.off("refuse invite");
			socket.off("set password");
		};
	}, [
		socket,
		addMessageToChatRoom,
		authenticatedUserID,
		cookies,
		navigate,
		serviceAnnouncement,
		setBanners,
	]);

	useEffect(() => {
		var request = {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${cookies["token"]}`,
			},
		};
		if (myChats.length === 0 && authenticatedUserID) {
			// Fetching Chats
			fetch(`/backend/users/${authenticatedUserID}/chats`, request).then(
				async (response) => {
					const chat_data = await response.json();
					if (!response.ok) {
						console.warn("error response load channels");
						return;
					}
					chat_data.map(async (chatRoom: any) => {
						var chan = await fetchChatData(
							chatRoom.id,
							chatRoom.name,
							chatRoom.isPrivate,
							chatRoom.isDirectMessage,
							request
						);
						setMyChats((prev) => {
							if (prev.find((c) => c.chatRoomID === chan.chatRoomID)) {
								return [...prev];
							} else {
								return [...prev, chan];
							}
						});
						return chatRoom;
					});
				}
			);
		}

		if (blockedUsers.length === 0 && authenticatedUserID) {
			// Fetching Chats
			fetch(`/backend/users/${authenticatedUserID}/blockedUsers`, request).then(
				async (response) => {
					const data = await response.json();
					if (!response.ok) {
						console.warn("error response load channels");
						return;
					}
					data.map(async (blockedRelationship: any) => {
						setBlockedUsers((prev) => [
							...prev,
							blockedRelationship.blockedUserID,
						]);
					});
				}
			);
		}

		if (publicChats.length === 0 && authenticatedUserID) {
			fetch(`/backend/chats/public`, request).then(async (response) => {
				const chat_data = await response.json();
				if (!response.ok) {
					console.warn("error response load channels");
					return;
				}
				chat_data.map(async (chatRoom: any) => {
					const newPublicChat: PublicChatRoom = {
						chatRoomID: chatRoom.id,
						name: chatRoom.name,
						hasPassword: await fetchHasPassword(chatRoom.id, request),
					};
					setPublicChats((prev) => [...prev, newPublicChat]);
					return chatRoom;
				});
			});
		}

		if (authenticatedUserID) {
			fetch(`/backend/invites/received/${authenticatedUserID}`, request).then(
				async (response) => {
					const data = await response.json();
					if (!response.ok) {
						console.warn("error response load invites");
						return;
					}
					setInvites([]);
					data.map((invite: Invite) => {
						return setInvites((prev) => [...prev, invite]);
					});
				}
			);
		}
	}, [
		currentPannel,
		authenticatedUserID,
		blockedUsers,
		cookies,
		myChats,
		publicChats,
	]);

	useEffect(() => {
		var message_els = document.getElementById("messages");
		if (!message_els) return;

		message_els.scrollTop = message_els.scrollHeight;
	}, [myChats]);

	useEffect(() => {
		if (getUsername(cookies) === undefined) {
			alert("You have no username");
		}
	}, [cookies]);

	// Open dm corresponding to userID if param in url
	useEffect(() => {
		if (!urlUserID || myChats.length === 0 || redirected) return;
		const targetUserID: number = Number(urlUserID);
		const targetDM: ChatRoom = myChats.find(
			(chatRoom: ChatRoom) =>
				chatRoom.isDM &&
				chatRoom.participants.find((user: User) => user.userID === targetUserID)
		);
		if (!targetDM) return;
		const targetDMID: number = targetDM.chatRoomID;
		setCurrentPannel({ type: PannelType.chat, chatRoomID: targetDMID });
		setRedirected(true);
	}, [myChats, redirected, urlUserID]);

	useEffect(() => {
		if (!authenticatedUserID) {
			navigate("/not-found");
		}
	}, [authenticatedUserID, navigate]);

	return (
		<>
			<div className="absolute flex top-0 bottom-0 left-0 right-0 bg-sage dark:bg-darksage ">
				<div
					className={`overflow-y-scroll rounded bg-lightblue dark:bg-darklightblue m-4 border-4 border-lightblue dark:border-darklightblue scrollbar-hide ${
						sidePannel
							? "relative left-0 top-0 w-[100%] md:w-[30%] rounded-md ease-in-out duration-500 z-10"
							: "ease-in-out duration-500 fixed h-full left-[-100%] z-10"
					}`}
				>
					{SidePannel(
						newchannel,
						setNewchannel,
						socket,
						settings,
						setSettings,
						contextMenu,
						setContextMenu,
						myChats,
						authenticatedUserID,
						currentPannel,
						setCurrentPannel,
						windowSize.width,
						setSidePannel
					)}
				</div>
				<div
					className={` z-20 text-darkblue dark:text-darkdarkblue overflow-y-clip `}
					onClick={toggleSidePannel}
				>
					<div className="h-full translate-y-1/2 pl-1">
						{sidePannel ? (
							<MdOutlineKeyboardDoubleArrowLeft size={25} />
						) : (
							<MdOutlineKeyboardDoubleArrowRight size={25} />
						)}
					</div>
				</div>
				<div
					className={`flex-grow justify-between bg-lightblue dark:bg-darklightblue rounded m-4 relative`}
				>
					{SettingsMenu(
						settings,
						setSettings,
						getChannel(currentPannel.chatRoomID),
						setCurrentPannel,
						socket,
						navigate,
						authenticatedUserID
					)}
					<div className={`${settings ? "hidden" : ""} `}>
						{Messages(
							getChannel(currentPannel.chatRoomID),
							navigate,
							settings,
							contextMenu,
							setContextMenu,
							setContextMenuPos,
							setContextMenuTarget,
							socket,
							invites,
							publicChats,
							cookies,
							myChats,
							authenticatedUserID,
							blockedUsers,
							setBlockedUsers,
							currentPannel,
							setCurrentPannel
						)}
						{SendForm(
							getChannel(currentPannel.chatRoomID),
							cookies,
							socket,
							authenticatedUserID
						)}
					</div>
				</div>
			</div>
			{ContextMenuEl(
				contextMenu,
				contextMenuTarget,
				setContextMenu,
				contextMenuPos,
				socket,
				getChannel(currentPannel.chatRoomID),
				cookies,
				myChats,
				authenticatedUserID,
				blockedUsers,
				setBlockedUsers
			)}
		</>
	);
};

export default Chat;
