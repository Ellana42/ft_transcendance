import { useContext, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { useCookies } from "react-cookie";
import { getUserID } from "../../cookies";
import { WebSocketContext } from "../../contexts/WebsocketContext";
import defaultProfilePicture from "./profilePicture.jpg";
import FriendsList from "./friendsList";
import GameHistory from "./history";
import ProfileSettings from "./profileSettings";

export type User = {
  id: number;
  username: string;
  email: string;
  login42: string;
};

function titleProfile(isMyPage: boolean, user: User) {
  if (user === undefined) return <h2>User not found</h2>;
  if (isMyPage) return <h2>My user page ({user.username})</h2>;

  return <h2>User page for {user.username}</h2>;
}

function userDetails(isMyPage: boolean, user: User) {
  if (user === undefined) return <div />;
  return (
    <p>
      {user.login42 ? " aka " + user.login42 : ""}
      <br /> Email is : {user.email}
    </p>
  );
}

function befriend(user: User, cookies: any) {
  // TODO: rather create friendship invite
  var request = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cookies["token"]}`,
    },
    body: JSON.stringify({
      userID1: getUserID(cookies),
      userID2: user.id,
    }),
  };
  fetch(`http://localhost:3001/friends`, request).then(async (response) => {
    console.log("response");
    console.log(response);
    if (!response.ok) {
      console.log("Error adding friend");
    }
  });
}

function unfriend(user: User, cookies: any) {
  var request = {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cookies["token"]}`,
    },
    body: JSON.stringify({
      userID1: getUserID(cookies),
      userID2: user.id,
    }),
  };
  fetch(`http://localhost:3001/friends`, request).then(async (response) => {
    console.log("response");
    console.log(response);
    if (!response.ok) {
      console.log("Error adding friend");
    }
  });
}

async function checkIfIsMyFriend(user: User, cookies: any, setIsMyFriend: any) {
  if (user === undefined) return;
  var request = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cookies["token"]}`,
    },
    body: JSON.stringify({
      userID1: getUserID(cookies),
      userID2: user.id,
    }),
  };
  await fetch(`http://localhost:3001/friends/friend`, request).then(
    async (response) => {
      console.log("is MY friend response");
      console.log(response);
      if (!response.ok) {
        setIsMyFriend(false);
        console.log("WE ARE ENNEMIES");
      } else {
        console.log("WE ARE FRIENDS");
        setIsMyFriend(true);
      }
    }
  );
}

function interactWithUser(
  isMyPage: boolean,
  isMyFriend: boolean,
  user: User,
  cookies: any
) {
  if (user === undefined) return <div />;
  if (isMyPage) return <p></p>;
  var friendshipButton: any;
  if (isMyFriend) {
    friendshipButton = (
      <button onClick={() => unfriend(user, cookies)}>Unfriend</button>
    );
  } else {
    friendshipButton = (
      <button onClick={() => befriend(user, cookies)}>Add friend</button>
    );
  }
  return (
    <p>
      {friendshipButton}
      <button>Block user</button>
      <button>Send DM</button>
    </p>
  );
}

function editProfile(
  isMyPage: boolean,
  user: User,
  isEditingProfile: any,
  setIsEditingProfile: any
) {
  if (user === undefined) return <div />;
  if (!isMyPage) return <div></div>;
  if (isEditingProfile) return <div></div>;
  return (
    <button
      onClick={() => {
        setIsEditingProfile(true);
      }}
    >
      Edit profile
    </button>
  );
}

function Profile() {
  const [userExists, setUserExists] = useState(false);
  var userID = useParams().id;
  const [user, setUser] = useState<User>();
  const [isMyPage, setIsMyPage] = useState(false);
  const [cookies] = useCookies(["cookie-name"]);
  const socket = useContext(WebSocketContext);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isMyFriend, setIsMyFriend] = useState(false);

  async function fetchUser() {
    var request = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cookies["token"]}`,
      },
    };

    fetch(`http://localhost:3001/users/${userID}`, request).then(
      async (response) => {
        const data = await response.json();
        if (!response.ok) {
          console.log("error response load channels");
          return <h1>No such user</h1>;
        }
        setUserExists(true);
        setUser({
          id: data.id,
          username: data.username,
          email: data.email,
          login42: data.login42 ? data.login42 : "",
        });
      }
    );
  }

  useEffect(() => {
    if (getUserID(cookies).toString() === userID) {
      socket.emit("login", cookies["token"]);
      setIsMyPage(true);
    }

    fetchUser();
    checkIfIsMyFriend(user, cookies, setIsMyFriend);
  }, [cookies, socket, userID]);

  useEffect(() => {
    checkIfIsMyFriend(user, cookies, setIsMyFriend);
  }, [user]);

  // TODO: add friendship invite section
  return (
    <div>
      <img src={defaultProfilePicture} width="100" height="100"></img>
      {!userExists ? "User is not logged in" : ""}
      {titleProfile(isMyPage, user)}
      {userDetails(isMyPage, user)}
      {interactWithUser(isMyPage, isMyFriend, user, cookies)}
      {editProfile(isMyPage, user, isEditingProfile, setIsEditingProfile)}
      {ProfileSettings(user, cookies, isEditingProfile, setIsEditingProfile)}
      {FriendsList(isMyPage, user, cookies)}
      {GameHistory(isMyPage, user, cookies)}
    </div>
  );
}

export default Profile;
