import React, { useState } from "react";

import {
  NavbarContainer,
  LeftContainer,
  RightContainer,
  NavbarExtendedContainer,
  NavbarInnerContainer,
  NavbarLinkContainer,
  NavbarLink,
  Logo,
  OpenLinksButton,
  NavbarLinkExtended,
} from "./NavBar.style";
import LogoImg from "./../../ping.svg";

function Navbar() {
  const [extendNavbar, setExtendNavbar] = useState(false);

  return (
    <NavbarContainer extendNavbar={extendNavbar}>
      <NavbarInnerContainer>
        <LeftContainer>
          <NavbarLinkContainer>
            <NavbarLink to="/"> Home</NavbarLink>
            <NavbarLink to="/login"> Login</NavbarLink>
            <NavbarLink to="/chat"> Chat</NavbarLink>
            <NavbarLink to="/play"> Play Game</NavbarLink>
            <NavbarLink to="/leaderboard"> Leaderboard</NavbarLink>
            <NavbarLink to="/auth"> Authenticate</NavbarLink>
            <OpenLinksButton
              onClick={() => {
                setExtendNavbar((curr) => !curr);
              }}
            >
              {extendNavbar ? <>&#10005;</> : <> &#8801;</>}
            </OpenLinksButton>
          </NavbarLinkContainer>
        </LeftContainer>
        <RightContainer>
          <Logo src={LogoImg}></Logo>
        </RightContainer>
      </NavbarInnerContainer>
      {extendNavbar && (
        <NavbarExtendedContainer>
          <NavbarLinkExtended to="/"> Home</NavbarLinkExtended>
          <NavbarLinkExtended to="/login"> Login</NavbarLinkExtended>
          <NavbarLinkExtended to="/chat"> Chat</NavbarLinkExtended>
          <NavbarLinkExtended to="/play"> Play</NavbarLinkExtended>
          <NavbarLinkExtended to="/leaderboard">
            {" "}
            Leaderboard
          </NavbarLinkExtended>
        </NavbarExtendedContainer>
      )}
    </NavbarContainer>
  );
}

export default Navbar;

