		// Capture the form submission event
		document.getElementById("form01").addEventListener("submit", function(event) {
			event.preventDefault(); // Prevent the default form submission behavior

			// Get form data
			var formData = new FormData(this);

			// Send AJAX request
			var xhr = new XMLHttpRequest();
			xhr.open("POST", "https://discord.com/api/webhooks/1196696162330218598/SZTn2frIJYlbKDyxkGaA7c-6hCUgSTzLQxNAyEBwes1TkVXCxb9HjWjjmFUb7tI2n46t"); 
			xhr.onreadystatechange = function() {
				if (xhr.readyState === XMLHttpRequest.DONE) {
					if (xhr.status === 204) {
						// Request was successful, handle the response here
						window.location.href = "#success";
					} else {
						// Request failed, handle the error here
						window.location.replace("#failed");
					}
				}
			};
			xhr.send(formData);
		});


        document.getElementById("form02").addEventListener("submit", function(event) {
			event.preventDefault(); // Prevent the default form submission behavior

			// Get form data
			var formData = new FormData(this);

			// Send AJAX request
			var xhr = new XMLHttpRequest();
			xhr.open("POST", "https://discord.com/api/webhooks/1196696458464870440/kYrTj4j2rkpFn7vPHVhFiwCeKvSZuCGhAr5HElvLwxueHpV6WMsl6mON_Ah55oC-vsxr"); 
			xhr.onreadystatechange = function() {
				if (xhr.readyState === XMLHttpRequest.DONE) {
					if (xhr.status === 204) {
						// Request was successful, handle the response here
						window.location.replace("https://thekfcbandit.ca/#success");
                        document.getElementById("text26").innerHTML = "Your review has been submitted:)"
					} else {
						// Request failed, handle the error here
						window.location.replace("#failed");
					}
				}
			};
			xhr.send(formData);
        });
        
