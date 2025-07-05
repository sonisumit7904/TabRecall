// TabRecall/src/utils/auth.js

// Configuration for backend integration
const CONFIG = {
  BACKEND_URL: "http://localhost:8081", // Adjust this to your actual backend URL
};

// Internal helper to get user info from Google using the access token
async function fetchGoogleUserInfo(accessToken) {
  try {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Google user info: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Google user info:", error);
    throw error;
  }
}

// Sends the Google Access Token to your backend for verification and session creation
async function sendAccessTokenToBackend(accessToken) {
  try {
    console.log("Auth Util: Making request to backend auth endpoint...");
    const response = await fetch(`${CONFIG.BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}` // Send accessToken in Authorization header
      },
      credentials: "include", // CRUCIAL: Include cookies for session management
    });

    console.log("Auth Util: Backend response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Auth Util: Backend authentication failed: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    console.log("Auth Util: Backend authentication successful:", result);
    return result;
  } catch (error) {
    console.error("Auth Util: Backend authentication error:", error);
    throw new Error(`Auth Util: Backend authentication failed: ${error.message}`);
  }
}

/**
 * Initiates the Google OAuth login flow and establishes a session with the backend.
 * @returns {Promise<Object>} Resolves with user info on success, rejects on error.
 */
export async function loginWithGoogle() {
  try {
    console.log("Auth Util: Starting Google OAuth flow...");

    // Use Chrome's identity API to get an OAuth access token
    const accessToken = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken(
        {
          interactive: true, // Prompts user for consent if needed
        },
        (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(token);
          }
        }
      );
    });

    console.log(
      "Auth Util: Got access token:",
      accessToken ? accessToken.substring(0, 20) + "..." : "null"
    );

    if (!accessToken) {
      throw new Error("No access token received from Google");
    }

    // Send access token to your backend for verification and session creation
    await sendAccessTokenToBackend(accessToken);

    // Fetch user info from Google for display
    const userInfo = await fetchGoogleUserInfo(accessToken);
    console.log("Auth Util: User info from Google:", userInfo);

    return userInfo; // Return user info for UI to display
  } catch (error) {
    console.error("Auth Util: Login process error:", error);
    throw error;
  }
}

/**
 * Checks the current login status by querying the backend.
 * @returns {Promise<Object|null>} Resolves with user info if logged in, null otherwise.
 */
export async function checkLoginStatus() {
  console.log("Auth Util: Checking login status with backend...");
  try {
    const response = await fetch(`${CONFIG.BACKEND_URL}/user`, {
      method: "GET",
      credentials: "include", // CRUCIAL: Browser sends existing session cookie
    });

    if (response.ok) {
      const user = await response.json();
      console.log("Auth Util: User is logged in:", user);
      return user; // Return user data
    } else {
      console.log("Auth Util: Not logged in (status:", response.status, ")");
      return null; // Not logged in
    }
  } catch (error) {
    console.error("Auth Util: Error checking login status:", error);
    return null; // Treat network errors or other issues as not logged in for UI purposes
  }
}

/**
 * Logs the user out by invalidating the session on the backend.
 * @returns {Promise<void>} Resolves on successful logout.
 */
export async function logoutUser() {
  try {
    console.log("Auth Util: Starting logout process...");
    const response = await fetch(`${CONFIG.BACKEND_URL}/auth/logout`, {
      method: "POST",
      credentials: "include", // CRUCIAL: Include cookies for session management
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Auth Util: Backend logout failed: ${response.status} - ${errorText}`
      );
    }

    console.log("Auth Util: Backend logout successful");
  } catch (error) {
    console.error("Auth Util: Logout error:", error);
    throw error;
  }
}
