import { useContext, useEffect, useState } from "react";
import {
  WebSocketContext,
  WebSocketProvider,
} from "../../contexts/WebsocketContext";

type Message = {
  datestamp: string;
  msg: string;
  sender: string;
  channel: string;
};

type Channel = {
  name: string;
};

export const Chat = () => {
  const socket = useContext(WebSocketContext);
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]); // TODO: init with database
  const [channels, setChannels] = useState<Channel[]>([]); // TODO: init with database

  useEffect(() => {
    var chan: Channel = {
      name: "First Channel",
    };
    setChannels((prev) => [...prev, chan]);
    chan.name = "Second Channel";
    setChannels((prev) => [...prev, chan]);
  }, []);

  useEffect(() => {
    socket.on("chat message", (msg: Message) => {
      console.log(msg);
      setMessages((prev) => [...prev, msg]);
      window.scrollTo(0, document.body.scrollHeight);
    });

    socket.on("connect", function () {
      console.log("I connected !");
      window.scrollTo(0, document.body.scrollHeight);
    });

    socket.on("connection event", function () {
      console.log("connection");
      window.scrollTo(0, document.body.scrollHeight);
    });

    socket.on("disconnection event", function () {
      console.log("disconnection");
      window.scrollTo(0, document.body.scrollHeight);
    });
    return () => {
      console.log("unregistering events");
      socket.off("chat message");
      socket.off("connection event");
      socket.off("disconnection event");
      socket.off("connect");
    };
  }, []);

  const handleSendMessage = () => {
    if (value == "") {
      return;
    }
    var msg: Message = {
      msg: value,
      datestamp: Date(),
      sender: "someone",
      channel: "chan",
    };
    socket.emit("chat message", msg);
    msg.sender = "me";
    setMessages((prev) => [...prev, msg]);
    setValue("");
  };

  const messageStatus = (msg: Message) => {
    if (msg.sender == "me") {
      return (
        <div id="rightmessage">
          <span id="sender">{msg.sender}</span>
          <span id="date">{msg.datestamp.split("G")[0]}</span>
          <li id="mine">{msg.msg}</li>
        </div>
      );
    }
    return (
      <div id="leftmessage">
        <span id="sender">{msg.sender}</span>
        <span id="date">{msg.datestamp.split("G")[0]}</span>
        <li id="othermsg">{msg.msg}</li>
      </div>
    );
  };

  const channelInfo = (channel: Channel) => {
    return (
      <div id="channel-info">
        <li>{channel.name}</li>
      </div>
    );
  };

  return (
    <WebSocketProvider value={socket}>
      <body>
        <div className="chat-container">
          <div className="sidebar">
            <div id="channels">
              {channels.map((channel: Channel) => channelInfo(channel))}
            </div>
          </div>
          <div className="chat">
            <div id="messages">
              {messages.map((msg: Message) => messageStatus(msg))}
            </div>
            <form id="form" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                }}
              />
              <button>Send</button>
            </form>
          </div>
        </div>
      </body>
    </WebSocketProvider>
  );
};

export default Chat;