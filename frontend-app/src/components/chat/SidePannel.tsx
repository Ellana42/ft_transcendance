import { Dispatch, ReactElement, SetStateAction } from "react";
import { Socket } from "socket.io-client";
import { ReceivedInfo, ChatRoom } from "./types";
import { MdOutlineMessage } from "react-icons/md";
import { getButtonIcon, ButtonIconType } from "../styles/icons";
import { separatorLine } from "../styles/separator";
import { PiChatsDuotone } from "react-icons/pi";
import { BiCommentAdd } from "react-icons/bi";
import { CurrentPannel, PannelType } from "./Chat";

enum ChanType {
	Channel,
	DM,
	Invites,
	PublicChans,
}

export const SidePannel = (
	newchannel: string,
	setNewchannel: Dispatch<SetStateAction<string>>,
	socket: Socket,
	settings: boolean,
	setSettings: Dispatch<SetStateAction<boolean>>,
	contextMenu: boolean,
	setContextMenu: Dispatch<SetStateAction<boolean>>,
	myChats: ChatRoom[],
	authenticatedUserID: number,
	currentPannel: CurrentPannel,
	setCurrentPannel: Dispatch<SetStateAction<CurrentPannel>>,
	windowWidth: number,
	setSidePannel: Dispatch<SetStateAction<boolean>>
) => {
	const createChannel = (e: any) => {
		e.preventDefault();
		if (newchannel === "") return;
		var info: ReceivedInfo = {
			chatInfo: {
				name: newchannel,
				isPrivate: false,
			},
		};
		socket.emit("add chat", info);
		setNewchannel("");
	};

	function getDMChannelAlias(channel: ChatRoom) {
		return channel.participants.find((p) => p.userID !== authenticatedUserID)
			.username;
	}

	const channelInfo = (type: ChanType, channel?: ChatRoom, key?: number) => {
		let isCurrent: boolean = false;
		let channel_alias: ReactElement;
		let settingButton: ReactElement;

		let select = (type: ChanType) => {
			setContextMenu(false);
			setSettings(false);
			switch (type) {
				case ChanType.Invites:
					setCurrentPannel({ type: PannelType.invite, chatRoomID: null });
					break;
				case ChanType.PublicChans:
					setCurrentPannel({ type: PannelType.publicChats, chatRoomID: null });
					break;
				default:
					setCurrentPannel({
						type: PannelType.chat,
						chatRoomID: channel.chatRoomID,
					});
					break;
			}
		};

		switch (type) {
			case ChanType.Invites:
				if (currentPannel.type === PannelType.invite) isCurrent = true;
				channel_alias = <div className="col-span-6">Invites</div>;
				break;
			case ChanType.PublicChans:
				if (currentPannel.type === PannelType.publicChats) isCurrent = true;
				channel_alias = <div className="col-span-6">Public Chats</div>;
				break;

			default:
				if (
					currentPannel.type === PannelType.chat &&
					channel.chatRoomID === currentPannel.chatRoomID
				)
					isCurrent = true;

				channel_alias = channel.isDM ? (
					<div className="col-span-5 flex justify-normal items-center">
						<MdOutlineMessage className="m-1 mr-2" />
						{getDMChannelAlias(channel)}
					</div>
				) : (
					<div className="col-span-5 flex justify-normal items-center">
						<PiChatsDuotone className="m-1 mr-2" />
						{channel.name}
					</div>
				);
				settingButton = (
					<button
						className={`border-2 border-darkblue dark:border-darkdarkblue text-sage dark:text-darksage m-2 rounded-md w-5 h-5 ${
							settings && isCurrent
								? "bg-teal dark:bg-darkteal hover:bg-darkblue hover:dark:bg-darkdarkblue"
								: "bg-darkblue dark:bg-darkdarkblue hover:bg-teal hover:dark:bg-darkteal"
						}`}
						onClick={() => {
							if (windowWidth < 768) {
								setSidePannel(false);
							}
							setSettings(true);
							setContextMenu(false);
							setCurrentPannel({
								type: PannelType.chat,
								chatRoomID: channel.chatRoomID,
							});
						}}
					>
						{getButtonIcon(ButtonIconType.settings, "h-4 w-4")}
					</button>
				);
				select = () => {
					if (windowWidth < 768) {
						setSidePannel(false);
					}
					var targetChannel = channel.chatRoomID;
					setCurrentPannel({
						type: PannelType.chat,
						chatRoomID: targetChannel,
					});
				};
				break;
		}
		return (
			<div
				key={key}
				onClick={() => {
					if (windowWidth < 768) {
						setSidePannel(false);
					}
					if (settings) {
						setSettings(false);
					}
					if (contextMenu) {
						setContextMenu(false);
					}
					select(type);
				}}
				className={`grid grid-cols-6 items-center justify-end text-darkblue dark:text-darkdarkblue rounded-md p-2 m-2 ${
					isCurrent
						? "bg-sage dark:bg-darksage border-2 border-darkblue dark:border-darkdarkblue"
						: "bg-sage dark:bg-darksage"
				}`}
			>
				{channel_alias}
				{settingButton ? (
					<div className="col-span-1 flex justify-end">{settingButton}</div>
				) : (
					<></>
				)}
			</div>
		);
	};

	return (
		<div className="">
			<form
				className="grid grid-cols-4 md:grid-cols-6 place-content-center gap-1 m-2"
				onSubmit={createChannel}
			>
				<input
					className="rounded-md col-span-3 md:col-span-5 bg-sage dark:bg-darksage p-2 placeholder:text-darkblue placeholder:dark:text-darkdarkblue placeholder:opacity-50 focus:outline-none focus:text-darkblue dark:focus:text-darkdarkblue"
					type="text"
					placeholder="Create new channel"
					value={newchannel}
					onChange={(e) => {
						setNewchannel(e.target.value);
					}}
				/>
				<button className="flex justify-center bg-darkblue dark:bg-darkdarkblue text-sage dark:text-darksage hover:bg-teal hover:dark:bg-darkteal p-1 py-2 rounded-md">
					<BiCommentAdd className="w-4 h-4 lg:w-6 lg:h-6" />
				</button>
			</form>
			<hr className="invisible h-1 mx-2"></hr>
			<div id="flex flex-col">
				{channelInfo(ChanType.Invites)}
				{channelInfo(ChanType.PublicChans)}
				{separatorLine("Private messages")}
				{myChats
					.filter((chat: ChatRoom) => chat.isDM)
					.sort((a, b) => a.name.localeCompare(b.name))
					.map((channel: ChatRoom, key: number) =>
						channelInfo(ChanType.Channel, channel, key)
					)}
				{separatorLine("Public chatrooms")}
				{myChats
					.filter((chat: ChatRoom) => !chat.isDM)
					.sort((a, b) => a.name.localeCompare(b.name))
					.map((channel: ChatRoom, key: number) =>
						channelInfo(ChanType.Channel, channel, key)
					)}
			</div>
		</div>
	);
};

export default SidePannel;
