import { User } from "./profile";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { ButtonIconType, getButtonIcon } from "../styles/icons";

async function readStream(response: any) {
	const reader = response.body.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			// Do something with last chunk of data then exit reader
			return value;
		}
		// Otherwise do something here to process current chunk
	}
}

function ProfileSettings(
	user: User,
	cookies: any,
	isEditingProfile: boolean,
	setIsEditingProfile: Dispatch<SetStateAction<boolean>>,
	authenticatedUserID: number
) {
	const [newUsername, setNewUsername] = useState("");
	const [newEmail, setNewEmail] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [is2faEnabled, setIs2faEnabled] = useState(false);
	const [qrcode, setQrcode] = useState();
	const [twoFaValidationCode, setTwoFaValidationCode] = useState("");
	const [newAvatar, setNewAvatar] = useState(null);

	useEffect(() => {
		if (user !== undefined) {
			setNewUsername(user.username);
			setNewEmail(user.email);
			setIs2faEnabled(user.isTwoFaEnabled);
		}
	}, [user]);

	// useEffect(() => {
	// 	console.log("Changing 2fa status");
	// 	setIs2faEnabled(getIs2faEnabled(cookies));
	// }, [cookies]);

	async function enable2Fa() {
		var request: any = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${cookies["token"]}`,
			},
		};
		return await fetch("/backend/auth/2fa/generate", request).then(
			async (response) => {
				const data = await response.json();
				if (!response.ok) {
					console.log("error QR code generation");
					return;
				}
				setQrcode(data);
			}
		);
		// TODO: post it to turn on and if it works close everything
	}

	function submitTwoFaValidationCode(e: any) {
		e.preventDefault();
		var request = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${cookies["token"]}`,
			},
			body: JSON.stringify({
				twoFactorAuthenticationCode: twoFaValidationCode.toString(),
			}),
		};

		fetch(`/backend/auth/2fa/turn-on`, request).then(async (response) => {
			const data = await response.json();
			if (!response.ok) {
				alert("Error with enabling 2fa: " + data.error + ": " + data.message);
				return;
			}
		});

		setTwoFaValidationCode("");
		setQrcode(null);
		setIs2faEnabled(true);
	}

	function disable2Fa() {
		// TODO: post request to turn off
		// TODO: if it works flip the switch
		// TODO: check if cookie is up to date
	}

	function submitUserInfo(e: any) {
		// TODO: dont send username if username has not changed
		var request = {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${cookies["token"]}`,
			},
			body: JSON.stringify({
				username: newUsername,
				email: newEmail,
			}),
		};
		e.preventDefault();
		fetch(`/backend/users/${authenticatedUserID}`, request).then(
			async (response) => {
				if (!response.ok) {
					const error = await response.json();
					alert("Error: " + error.error + ": " + error.message);
				}
			}
		);
	}

	function submitNewPassword(e: any) {
		var request = {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${cookies["token"]}`,
			},
			body: JSON.stringify({
				currentPassword: currentPassword,
				newPassword: newPassword,
			}),
		};
		e.preventDefault();
		fetch(`/backend/users/${authenticatedUserID}`, request).then(
			async (response) => {
				if (!response.ok) {
					const error = await response.json();
					alert("Error: " + error.error + ": " + error.message);
				}
			}
		);
	}

	async function submitNewAvatar(e: any) {
		e.preventDefault();
		const formData = new FormData(e.target.closest("form"));
		console.log("Form data");
		console.log(formData);

		var request = {
			method: "POST",
			headers: {
				Authorization: `Bearer ${cookies["token"]}`,
			},
			body: formData,
		};
		await fetch(`/backend/users/${authenticatedUserID}/avatar`, request).then(
			async (response) => {
				if (!response.ok) {
					console.log("There was an issue with changing your avatar");
				} else {
					// TODO: change current image
				}
			}
		);
	}

	async function removeAvatar(e: any) {
		e.preventDefault();
		var request = {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${cookies["token"]}`,
			},
		};
		await fetch(`/backend/users/${authenticatedUserID}/avatar`, request).then(
			async (response) => {
				if (!response.ok) {
					console.log("There was an issue with removing your avatar");
				}
			}
		);
	}

	if (!isEditingProfile) return <div></div>;

	return (
		<div className="text-darkblue bg-teal rounded-md p-2">
			<div className="flex justify-between m-2">
				<h2 className="font-bold text-sage text-lg">Settings</h2>
				<button
					onClick={() => {
						setIsEditingProfile(false);
					}}
				>
					{getButtonIcon(ButtonIconType.closeSettings, "w-6 h-6 text-sage")}
				</button>
			</div>
			<div className="bg-lightblue rounded-md m-2 p-2">
				<h3 className="font-bold">Avatar</h3>
				{newAvatar && (
					<img
						alt="not found"
						width={"250px"}
						src={URL.createObjectURL(newAvatar)}
						className="w-8 h-8 rounded-full lg:w-15 lg:h-15 m-2"
					/>
				)}
				<form id="avatar-form">
					<input
						type="file"
						name="file"
						onChange={(event) => {
							console.log(event.target.files[0]);
							setNewAvatar(event.target.files[0]);
						}}
					/>
					<button className="button" onClick={submitNewAvatar}>
						Save new avatar
					</button>
				</form>
				<button className="button" onClick={removeAvatar}>
					Remove avatar
				</button>
			</div>
			<div className="bg-lightblue rounded-md m-2 p-2">
				<h3 className="font-bold">Personal Information</h3>
				<form className="edit_field" onSubmit={submitUserInfo}>
					<input
						value={newUsername}
						onChange={(e) => {
							setNewUsername(e.target.value);
						}}
					/>
					<input
						value={newEmail}
						onChange={(e) => {
							setNewEmail(e.target.value);
						}}
					/>
					<button className="button">Save changes</button>
				</form>
			</div>
			<div className="bg-lightblue rounded-md m-2 p-2">
				<h3 className="font-bold">Security</h3>
				<input
					type="checkbox"
					checked={is2faEnabled}
					onChange={() => {
						enable2Fa();
					}}
				/>
				<label> Enable two-factor authentication</label>
				{qrcode && (
					<div>
						<img src={qrcode}></img>

						<form onSubmit={submitTwoFaValidationCode}>
							<input
								placeholder="2fa validation code"
								value={twoFaValidationCode}
								onChange={(e) => {
									setTwoFaValidationCode(e.target.value);
								}}
							/>
							<button className="button">Submit</button>
						</form>
					</div>
				)}
				<canvas id="canvas"></canvas>
			</div>
		</div>
	);
}

export default ProfileSettings;
