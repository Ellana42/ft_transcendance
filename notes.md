- Appearance

  - CSS fix buttons

- Bugs

  - all libraries are in latest stable version
  - remove unused libraries/modules + fix dependancy issues on frontend backend container creation?
  - Fix offline/online AGAIN
  - grosse photo marche pas 
  - quand fiona se connecte ça marche pas (avec 42)
  - button challenge in profile doesn't work
  - change size game window height

- Check
	- check it is ok to see status onlines for people not friends with

- Project validation

  - reset game score to 10
  - remove passwords for users
  - remove login page
  - force HTTPS and force redirect HTTP port 80 to HTTPS port 443
  - choose domain (localhost or ft_transcendance or whatever) and then fix callback URL for 42 auth
  - remove unused controller paths (i.e. chats controller since all is done through sockets)

- Nice to have

  - all tokens are taken directly from socket
  - replay button on you won/ you lost screens
  - dark mode
  - publish website (see clevercloud)

- IF PROBLEMS WITH LOGOUT/BAD TOKEN:
  - Add window force reload: window.location.reload(); in function LogoutUser
