let aLink = document.getElementById("avatarLink");
let aImg = document.getElementById("avatarImg");
let aMotd = document.getElementById("status");
let a = document.getElementById("avatar");

let discordID = "79427255851298816";

fetch(`https://api.lanyard.rest/v1/users/${discordID}`)
	.then((response) => response.json())
	.then((data) => {

		if (data.data.discord_user) {
			aLink.href = `https://discord.com/users/${data.data.discord_user.id}`;
			aImg.src = `https://cdn.discordapp.com/avatars/${data.data.discord_user.id}/${data.data.discord_user.avatar}`;
			const customStatus = data.data.activities.find(activity => activity.name === "Custom Status");
			if (customStatus) {
				aMotd.innerHTML = customStatus.state;
			} else {
				aMotd.innerHTML = "<em> no status :( </em>";
			}

		}

		if (data.data.discord_status === "online") {
			aLink.style.borderColor = "#23a55a";
			a.title = "online";
		} else if (data.data.discord_status === "idle") {
			aLink.style.borderColor = "#f0b232";
			a.title = "idle";
		} else if (data.data.discord_status === "dnd") {
			aLink.style.borderColor = "#f23f43";
			a.title = "dnd";
		} else if (data.data.discord_status === "offline") {
			aLink.style.borderColor = "#80848e";
			a.title = "offline";
		}



	});
