import { useContext, useEffect } from "react";
import { useCookies } from "react-cookie";
import { useNavigate } from "react-router-dom";
import { WebSocketContext } from "../../contexts/WebsocketContext";
import { AuthenticationContext } from "../authenticationState";

function Logout() {
  const [cookies, , removeCookie] = useCookies(["token"]);
  const { setAuthenticatedUserID } = useContext(AuthenticationContext);
  const navigate = useNavigate();
  const socket = useContext(WebSocketContext);

  function logout() {
    socket.emit("logout", cookies["token"]);
    setAuthenticatedUserID(null);
    removeCookie("token", { path: "/" });
    navigate("/");
  }

  useEffect(() => {
    logout();
  }, []);
}
export default Logout;