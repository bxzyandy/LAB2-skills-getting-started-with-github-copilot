document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Helper to escape HTML in strings
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants fragment
        let participantsHTML = "";
        if (Array.isArray(details.participants) && details.participants.length > 0) {
          // Build participants list with a delete button for each participant
          participantsHTML = `<ul class="participants-list">` +
            details.participants
              .map((p) =>
                `<li class="participant-item"><span class="participant-email">${escapeHtml(p)}</span>` +
                `<button class="delete-participant" title="Unregister">✖</button></li>`
              )
              .join("") +
            `</ul>`;
        } else {
          participantsHTML = `<p class="no-participants">No participants yet.</p>`;
        }

        activityCard.innerHTML = `
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(details.description)}</p>
          <p><strong>Schedule:</strong> ${escapeHtml(details.schedule)}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-section">
            <h5>Participants</h5>
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Attach unregister handlers to the delete buttons we just rendered
        const deleteButtons = activityCard.querySelectorAll('.delete-participant');
        deleteButtons.forEach((btn) => {
          btn.addEventListener('click', async (e) => {
            // Find the participant email from the sibling span (unescaped text)
            const li = btn.closest('.participant-item');
            if (!li) return;
            const emailSpan = li.querySelector('.participant-email');
            if (!emailSpan) return;
            const email = emailSpan.textContent.trim();

            // Disable button while request is in-flight
            btn.disabled = true;

            try {
              const resp = await fetch(
                `/activities/${encodeURIComponent(name)}/unregister?email=${encodeURIComponent(email)}`,
                { method: 'POST' }
              );

              if (resp.ok) {
                // Refresh the activities to reflect the change
                fetchActivities();
              } else {
                // Try to show error in console and keep UI stable
                const data = await resp.json().catch(() => ({}));
                console.error('Failed to unregister:', data);
              }
            } catch (err) {
              console.error('Error unregistering participant:', err);
            } finally {
              btn.disabled = false;
            }
          });
        });

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // Refresh activities to show updated participants/availability
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
