// Initialize the dialog when the page loads
document.addEventListener("DOMContentLoaded", function () {
  // Azure server base URL
  const SERVER_BASE_URL =
    "https://moneytalkspurchasing-2-bkftf2deeyexc3c0.eastus-01.azurewebsites.net";

  // Show the modal immediately and prevent closing
  const adminModal = new bootstrap.Modal(
    document.getElementById("adminDialog"),
    {
      backdrop: "static",
      keyboard: false,
    }
  );

  adminModal.show();

  // Global variables for admin session
  let adminEmail = null;
  let currentCodeId = null;
  let schoolData = null;

  // Form handling
  const emailForm = document.getElementById("emailForm");
  const sendButton = emailForm.querySelector(".custom-send-btn");
  const btnText = sendButton.querySelector(".btn-text");
  const btnSpinner = sendButton.querySelector(".btn-spinner");
  const recipientInput = document.getElementById("recipient");
  const subjectInput = document.getElementById("subject");
  const bodyTextarea = document.getElementById("body");

  // Initialize admin session
  initializeAdminSession();

  async function initializeAdminSession() {
    try {
      // Get admin email from URL parameters or prompt
      const urlParams = new URLSearchParams(window.location.search);
      adminEmail = urlParams.get("admin_email");

      if (!adminEmail) {
        adminEmail = prompt("Please enter your admin email address:");
        if (!adminEmail) {
          alert("Admin email is required to access this portal.");
          return;
        }
      }

      // Validate admin and load school data
      await validateAdminAndLoadData();

      // Load the first teacher code
      await loadNextTeacherCode();
    } catch (error) {
      console.error("Error initializing admin session:", error);
      alert(
        "Error loading admin portal. Please check your email address and try again."
      );
    }
  }

  async function validateAdminAndLoadData() {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/validate-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ admin_email: adminEmail }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        throw new Error(data.error || "Invalid admin credentials");
      }

      schoolData = data;

      // Update modal title with school name
      document.getElementById(
        "adminDialogLabel"
      ).textContent = `Teacher Access Code Distribution - ${schoolData.school_name}`;
    } catch (error) {
      console.error("Error validating admin:", error);
      throw error;
    }
  }

  async function loadNextTeacherCode() {
    try {
      showLoadingState();

      const response = await fetch(
        `${SERVER_BASE_URL}/get-next-teacher-code/${adminEmail}`
      );
      const data = await response.json();

      if (!response.ok) {
        if (data.codes_exhausted) {
          // All codes have been sent
          showCompletionMessage();
          return;
        }
        throw new Error(data.error || "Failed to load teacher code");
      }

      // Populate form with template
      currentCodeId = data.code_id;
      subjectInput.value = data.subject;
      bodyTextarea.value = data.body;

      // Clear recipient field for new teacher
      recipientInput.value = "";
      recipientInput.focus();

      // Update button text to show progress
      updateProgressDisplay();

      hideLoadingState();
    } catch (error) {
      console.error("Error loading next teacher code:", error);
      hideLoadingState();
      alert("Error loading teacher code: " + error.message);
    }
  }

  async function updateProgressDisplay() {
    try {
      const response = await fetch(
        `${SERVER_BASE_URL}/admin-stats/${adminEmail}`
      );
      const stats = await response.json();

      if (response.ok) {
        const progress = `${stats.codes_sent} of ${stats.total_teacher_licenses} codes sent`;
        btnText.textContent =
          stats.codes_remaining > 0
            ? `Send Code (${stats.codes_remaining} remaining)`
            : "All Codes Sent";
      }
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  }

  function showCompletionMessage() {
    // Update form to show completion
    subjectInput.value = "All Teacher Codes Distributed";
    bodyTextarea.value = `Congratulations! You have successfully distributed all teacher access codes for ${schoolData.school_name}.

All ${schoolData.teacher_licenses} teacher licenses have been sent out. Teachers should now be able to register using their access codes.

What happens next:
1. Teachers will use their access codes to register on the Trinity Capital platform
2. Once registered, teachers can create class codes for their students
3. Students will use the class codes provided by their teachers to access the platform

If you need to track which codes have been used or need additional support, please contact the Trinity Capital support team.

Thank you for using Trinity Capital!`;

    recipientInput.value = "";
    recipientInput.disabled = true;
    sendButton.disabled = true;
    btnText.textContent = "All Codes Distributed";
    sendButton.style.backgroundColor = "#28a745";
    sendButton.style.borderColor = "#28a745";
  }

  // Form submission handler
  emailForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Get form data
    const formData = {
      recipient: recipientInput.value.trim(),
      subject: subjectInput.value.trim(),
      body: bodyTextarea.value.trim(),
    };

    // Validate form
    if (!validateForm(formData)) {
      return;
    }

    // Show loading state
    showLoadingState();

    try {
      // Send email
      await sendTeacherCodeEmail(formData);

      // Show success message briefly
      showSuccessMessage();

      // Load next code after a short delay
      setTimeout(async () => {
        await loadNextTeacherCode();
      }, 2000);
    } catch (error) {
      console.error("Error sending email:", error);
      hideLoadingState();
      alert("Error sending email: " + error.message);
    }
  });

  async function sendTeacherCodeEmail(formData) {
    const response = await fetch(`${SERVER_BASE_URL}/send-teacher-code-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        admin_email: adminEmail,
        recipient_email: formData.recipient,
        subject: formData.subject,
        body: formData.body,
        code_id: currentCodeId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to send email");
    }

    return data;
  }

  // Form validation function
  function validateForm(data) {
    let isValid = true;
    const inputs = {
      recipient: recipientInput,
      subject: subjectInput,
      body: bodyTextarea,
    };

    // Reset validation states
    Object.values(inputs).forEach((input) => {
      input.classList.remove("is-invalid", "is-valid");
    });

    // Validate recipient email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.recipient || !emailRegex.test(data.recipient)) {
      inputs.recipient.classList.add("is-invalid");
      isValid = false;
    } else {
      inputs.recipient.classList.add("is-valid");
    }

    // Validate subject
    if (!data.subject || data.subject.length < 5) {
      inputs.subject.classList.add("is-invalid");
      isValid = false;
    } else {
      inputs.subject.classList.add("is-valid");
    }

    // Validate body
    if (!data.body || data.body.length < 10) {
      inputs.body.classList.add("is-invalid");
      isValid = false;
    } else {
      inputs.body.classList.add("is-valid");
    }

    return isValid;
  }

  // Show loading state
  function showLoadingState() {
    sendButton.classList.add("loading");
    btnText.classList.add("d-none");
    btnSpinner.classList.remove("d-none");
    sendButton.disabled = true;
  }

  // Hide loading state
  function hideLoadingState() {
    sendButton.classList.remove("loading");
    btnText.classList.remove("d-none");
    btnSpinner.classList.add("d-none");
    sendButton.disabled = false;
  }

  // Show success message
  function showSuccessMessage() {
    const originalText = btnText.textContent;
    btnText.textContent = "Email Sent!";
    sendButton.style.backgroundColor = "#28a745";
    sendButton.style.borderColor = "#28a745";

    setTimeout(() => {
      sendButton.style.backgroundColor = "";
      sendButton.style.borderColor = "";
    }, 2000);
  }

  // Prevent modal from being closed
  document
    .getElementById("adminDialog")
    .addEventListener("hide.bs.modal", function (e) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });

  // Auto-resize textarea
  bodyTextarea.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.max(150, this.scrollHeight) + "px";
  });

  // Add real-time validation feedback
  const inputs = document.querySelectorAll(".form-control");
  inputs.forEach((input) => {
    input.addEventListener("blur", function () {
      const formData = {
        recipient: recipientInput.value.trim(),
        subject: subjectInput.value.trim(),
        body: bodyTextarea.value.trim(),
      };
      validateForm(formData);
    });
  });
});

// Prevent page refresh and other escape methods
window.addEventListener("beforeunload", function (e) {
  e.preventDefault();
  e.returnValue = "";
  return "";
});

// Disable common keyboard shortcuts that might close the page
document.addEventListener("keydown", function (e) {
  // Disable F5 (refresh)
  if (e.key === "F5") {
    e.preventDefault();
  }

  // Disable Ctrl+R (refresh)
  if (e.ctrlKey && e.key === "r") {
    e.preventDefault();
  }

  // Disable Ctrl+W (close tab)
  if (e.ctrlKey && e.key === "w") {
    e.preventDefault();
  }

  // Disable Alt+F4 (close window)
  if (e.altKey && e.key === "F4") {
    e.preventDefault();
  }
});
