		// Capture the form submission event
		document.getElementById("form01").addEventListener("submit", function(event) {
			event.preventDefault(); // Prevent the default form submission behavior

			// Get form data
			var formData = new FormData(this);

			// Send AJAX request
			var xhr = new XMLHttpRequest();
			xhr.open("POST", "https://discord.com/api/webhooks/938629076200091698/j68iRXHp0IGLaE1VwR13mVQ0YpSV-yKcCODn0nQC7AWNreYZ1__fMKjZKP8wsdGG3Oxe"); // Replace "your-server-url" with the actual URL to handle the form submission on the server
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
			xhr.open("POST", "https://discord.com/api/webhooks/938629228927266816/84NBGM8Ttlx5GnGVNujH58LZ88CXhEYLvpxRxoi80AbjA3PlXY7nboSEEMxvKqYecqyg"); // Replace "your-server-url" with the actual URL to handle the form submission on the server
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
        
