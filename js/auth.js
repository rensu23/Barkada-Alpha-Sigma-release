import { loginUser, registerUser, requestPasswordReset, resetPassword } from "./services/auth.service.js";
import { getSession } from "./utils/storage.js";
import { hasStrongEnoughPassword, isRequired, isValidEmail, passwordsMatch } from "./validators.js";
import { showToast } from "./ui.js";

function showFieldError(form, name, message = "") {
  const target = form.querySelector(`[data-error-for="${name}"]`);
  if (target) target.textContent = message;
}

function clearErrors(form) {
  form.querySelectorAll("[data-error-for]").forEach((item) => {
    item.textContent = "";
  });
}

function bindPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.passwordToggle);
      const isPassword = target.type === "password";
      target.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "Hide" : "Show";
    });
  });
}

export function initRouteGuards() {
  const appPage = document.body.dataset.appPage;
  const publicPage = document.body.dataset.page;
  const session = getSession();

  // Static HTML pages are guarded by getCurrentSession() in main.js before
  // app data is loaded.

  return true;
}

export function initAuthPages() {
  bindPasswordToggles();
  const page = document.body.dataset.page;

  if (page === "login") {
    const form = document.querySelector("[data-login-form]");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearErrors(form);
      const payload = Object.fromEntries(new FormData(form).entries());
      let valid = true;

      if (!isValidEmail(payload.email)) {
        showFieldError(form, "email", "Enter a valid email address.");
        valid = false;
      }
      if (!isRequired(payload.password)) {
        showFieldError(form, "password", "Enter your password.");
        valid = false;
      }
      if (!valid) return;

      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      button.textContent = "Logging in...";
      try {
        await loginUser(payload);
        showToast("Logged in. Redirecting to your dashboard.");
        window.setTimeout(() => {
          const redirect = new URLSearchParams(window.location.search).get("redirect");
          window.location.href = redirect || "../pages/dashboard.html";
        }, 420);
      } catch (error) {
        showFieldError(form, "password", error.message);
      } finally {
        button.disabled = false;
        button.textContent = "Log in";
      }
    });
  }

  if (page === "signup") {
    const form = document.querySelector("[data-signup-form]");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearErrors(form);
      const payload = Object.fromEntries(new FormData(form).entries());
      let valid = true;

      if (!isRequired(payload.name)) {
        showFieldError(form, "name", "Please enter your full name.");
        valid = false;
      }
      if (!isValidEmail(payload.email)) {
        showFieldError(form, "email", "Enter a valid email address.");
        valid = false;
      }
      if (!hasStrongEnoughPassword(payload.password)) {
        showFieldError(form, "password", "Use at least 8 characters.");
        valid = false;
      }
      if (!passwordsMatch(payload.password, payload.confirm_password)) {
        showFieldError(form, "confirm_password", "Passwords do not match.");
        valid = false;
      }
      if (!valid) return;

      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      button.textContent = "Creating account...";
      try {
        await registerUser(payload);
        showToast("Account created. You can now log in.");
        window.setTimeout(() => {
          window.location.href = "../pages/login.html";
        }, 420);
      } catch (error) {
        showFieldError(form, "email", error.message);
      } finally {
        button.disabled = false;
        button.textContent = "Create account";
      }
    });
  }

  if (page === "forgot-password") {
    const form = document.querySelector("[data-forgot-form]");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearErrors(form);
      const payload = Object.fromEntries(new FormData(form).entries());
      if (!isValidEmail(payload.email)) {
        showFieldError(form, "email", "Enter a valid email address.");
        return;
      }
      try {
        const result = await requestPasswordReset(payload);
        const feedback = document.querySelector("[data-auth-feedback]");
        feedback.textContent = result.message || "Email checked. Opening the reset page...";
        feedback.className = "success-text";

        // The project has no email-token table, so the next page asks for the
        // new password and uses this email as the account identifier.
        window.setTimeout(() => {
          const params = new URLSearchParams({ email: payload.email });
          window.location.href = `./reset-password.html?${params.toString()}`;
        }, 500);
      } catch (error) {
        document.querySelector("[data-auth-feedback]").textContent = error.message;
        document.querySelector("[data-auth-feedback]").className = "error-text";
      }
    });
  }

  if (page === "reset-password") {
    const form = document.querySelector("[data-reset-form]");
    const emailFromLink = new URLSearchParams(window.location.search).get("email");
    if (form?.email && emailFromLink) {
      form.email.value = emailFromLink;
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearErrors(form);
      const payload = Object.fromEntries(new FormData(form).entries());
      let valid = true;
      if (!isValidEmail(payload.email)) {
        showFieldError(form, "email", "Enter the email tied to your account.");
        valid = false;
      }
      if (!hasStrongEnoughPassword(payload.password)) {
        showFieldError(form, "password", "Use at least 8 characters.");
        valid = false;
      }
      if (!passwordsMatch(payload.password, payload.confirm_password)) {
        showFieldError(form, "confirm_password", "Passwords do not match.");
        valid = false;
      }
      if (!valid) return;

      try {
        await resetPassword(payload);
        showToast("Password updated.");
        window.setTimeout(() => {
          window.location.href = "../pages/login.html";
        }, 380);
      } catch (error) {
        showFieldError(form, "password", error.message);
      }
    });
  }
}
