import { Dispatch, SetStateAction, useState } from "react";
import { NavigateFunction } from "react-router-dom";
import { Message, Status } from "./chat";
import { ContextMenuEl } from "./context_menu";

export const Messages = (
  messages: Message[],
  current_channel: string,
  username: string,
  navigate: NavigateFunction,
  settings: boolean,
  contextMenu: boolean,
  setContextMenu: Dispatch<SetStateAction<boolean>>,
  status: Status
) => {
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextMenuSender, setContextMenuSender] = useState("");

  const messageStatus = (msg: Message) => {
    if (msg.channel != current_channel) return;
    if (msg.sender == username) {
      return (
        <div id="rightmessage">
          <span
            id="sender"
            onClick={() => {
              navigate("/user/" + msg.sender);
            }}
          >
            {msg.sender}
          </span>
          <span id="date">{msg.datestamp.toString().split("G")[0]}</span>
          <li id="mine">{msg.msg}</li>
        </div>
      );
    }
    return (
      <div id="leftmessage">
        <span
          id="sender"
          onClick={() => {
            navigate("/user/" + msg.sender);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (current_channel !== "" && settings === false) {
              setContextMenu(true);
              setContextMenuPos({ x: e.pageX, y: e.pageY });
              setContextMenuSender(msg.sender);
            }
          }}
        >
          {msg.sender}
        </span>
        <span id="date">{msg.datestamp.toString().split("G")[0]}</span>
        <li id="othermsg">{msg.msg}</li>
      </div>
    );
  };

  return (
    <div id="messages">
      {messages.map((msg: Message) => messageStatus(msg))}
      {ContextMenuEl(
        contextMenu,
        contextMenuSender,
        status,
        setContextMenu,
        contextMenuPos
      )}
    </div>
  );
};

export default Messages;
