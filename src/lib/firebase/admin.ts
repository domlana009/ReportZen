
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// State variables to track initialization status
let adminAuthInstance: admin.auth.Auth | null = null;
let initializationError: Error | null = null;
let isInitialized = false;
let initializedVia: string | null = null;
const serviceAccountFilename = 'reportzen-mixd3-firebase-adminsdk-fbsvc-f006f10e8d.json'; // Keep filename consistent

/**
 * Initializes the Firebase Admin SDK using credentials from environment variables or a local file.
 * This function should only run once.
 */
function initializeFirebaseAdmin() {
  if (isInitialized) {
    // Avoid re-logging if already initialized successfully or with the same error
    if (adminAuthInstance) {
      console.log(`Firebase Admin SDK: Already initialized successfully via ${initializedVia || 'unknown'}.`);
    } else if (initializationError) {
      // Log the existing error again if re-attempted, might indicate multiple init calls
       console.error(`Firebase Admin SDK: Initialization previously failed. Error: ${initializationError.message}`);
    }
    return;
  }
  isInitialized = true; // Mark as attempted

  console.log("Firebase Admin SDK: Starting initialization attempt...");

  let serviceAccountJson: string | null = null;
  let credentialSource: string | null = null; // Track where credentials came from

  // --- Attempt to Load Credentials ---

  // Method 1: Environment Variable (Recommended for deployment)
  const envVarKey = 'FIREBASE_SERVICE_ACCOUNT_KEY';
  const envVarValue = process.env[envVarKey];
  console.log(`Firebase Admin SDK: Checking environment variable ${envVarKey}...`);

  if (envVarValue && envVarValue.trim() !== '' && envVarValue.trim() !== '{}') {
    console.log(`Firebase Admin SDK: Found ${envVarKey} environment variable (length: ${envVarValue.length}). Validating JSON...`);
    try {
      // Validate JSON structure rigorously
      const parsed = JSON.parse(envVarValue);
      if (typeof parsed !== 'object' || parsed === null || !parsed.project_id || !parsed.private_key || !parsed.client_email) {
        throw new Error("Parsed JSON object is invalid or missing required fields (project_id, private_key, client_email).");
      }
      serviceAccountJson = envVarValue;
      credentialSource = 'environment variable';
      console.log(`Firebase Admin SDK: Successfully validated JSON from ${envVarKey}.`);
    } catch (e: any) {
      initializationError = new Error(`CRITICAL - Failed to parse service account JSON from ${envVarKey}. Ensure it's valid, complete, single-line JSON. Error: ${e.message}`);
      console.error(`Firebase Admin SDK: ${initializationError.message}`);
      // Log a snippet carefully, excluding sensitive parts like private_key if possible
      const snippet = (envVarValue || '').substring(0, 80).replace(/"private_key":\s*".*?"/, '"private_key":"[REDACTED]"');
      console.error(`Firebase Admin SDK: JSON snippet (approx first 80 chars, key redacted): ${snippet}...`);
      return; // Stop initialization if env var is invalid JSON
    }
  } else {
    console.log(`Firebase Admin SDK: ${envVarKey} environment variable not found, empty, or just '{}'.`);
  }

  // Method 2: Local File (Easier for local dev, ensure it's gitignored)
  if (!serviceAccountJson) {
    const serviceAccountPath = path.resolve(`./${serviceAccountFilename}`);
    console.log(`Firebase Admin SDK: Checking for local file at ${serviceAccountPath}...`);
    try {
      if (fs.existsSync(serviceAccountPath)) {
        serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
        if (serviceAccountJson.trim() === '') {
          console.warn(`Firebase Admin SDK: Local file ${serviceAccountFilename} exists but is empty.`);
          serviceAccountJson = null; // Treat empty file as not found
        } else {
           console.log(`Firebase Admin SDK: Found local file ${serviceAccountFilename}. Validating JSON...`);
           // Validate JSON structure rigorously
          const parsed = JSON.parse(serviceAccountJson);
           if (typeof parsed !== 'object' || parsed === null || !parsed.project_id || !parsed.private_key || !parsed.client_email) {
               throw new Error("Parsed JSON object is invalid or missing required fields (project_id, private_key, client_email).");
           }
          credentialSource = `local file (${serviceAccountFilename})`;
          console.log(`Firebase Admin SDK: Successfully validated JSON from ${serviceAccountFilename}.`);
        }
      } else {
        console.log(`Firebase Admin SDK: Local file ${serviceAccountFilename} not found at ${serviceAccountPath}.`);
      }
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        initializationError = new Error(`CRITICAL - Failed to parse service account JSON from ${serviceAccountFilename}. Ensure it's valid JSON. Error: ${error.message}`);
      } else {
        initializationError = new Error(`CRITICAL - Error reading local ${serviceAccountFilename}: ${error.message}`);
      }
      console.error(`Firebase Admin SDK: ${initializationError.message}`);
      serviceAccountJson = null; // Ensure it's null if read/parse failed
      return; // Stop initialization if local file is invalid
    }
  }

  // --- Check if Credentials Were Found ---
  if (!serviceAccountJson) {
    initializationError = new Error(`CRITICAL - No valid service account credentials found. Cannot initialize. Checked environment variable '${envVarKey}' and local file at '${path.resolve(`./${serviceAccountFilename}`)}'.`);
    console.error(`Firebase Admin SDK: ${initializationError.message} Please refer to README.md for setup instructions.`);
    return;
  }

  // --- Initialize Firebase Admin SDK ---
  // Check if the SDK is already initialized (might happen in some hot-reload scenarios)
  if (admin.apps.length > 0) {
    console.log(`Firebase Admin SDK: Already initialized (detected ${admin.apps.length} existing admin app(s)). Using existing auth instance.`);
    adminAuthInstance = admin.auth(); // Use existing auth instance
    initializedVia = credentialSource || 'existing app detection'; // Log how credentials *would* have been loaded
    initializationError = null; // Clear any potential errors from credential loading if an app already exists
    return;
  }

  let serviceAccount;
  try {
    // Re-parsing should be safe as we validated above
    serviceAccount = JSON.parse(serviceAccountJson);
    console.log(`Firebase Admin SDK: Attempting initialization via ${credentialSource}...`);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // Optionally add databaseURL if using Realtime Database
      // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });
    console.log(`Firebase Admin SDK: Initialization successful for project ${serviceAccount.project_id}.`);
    adminAuthInstance = admin.auth(); // Assign instance on success
    initializedVia = credentialSource; // Confirm initialization source
    initializationError = null; // Clear any previous errors on success
  } catch (error: any) {
    // Handle specific initialization errors
    if (error.code === 'app/duplicate-app') {
      console.warn("Firebase Admin SDK: Attempted to initialize an app that already exists ('app/duplicate-app'). Using existing app's auth service.");
      if (admin.apps.length > 0 && admin.apps[0]) {
        adminAuthInstance = admin.apps[0].auth();
        initializedVia = credentialSource || 'existing app detection';
        initializationError = null; // Clear the error as we recovered
        return;
      } else {
        initializationError = new Error(`CRITICAL - Caught 'app/duplicate-app' error but no existing app found. Initialization failed. Error: ${error.message}`);
      }
    } else {
      initializationError = new Error(`CRITICAL - Error during admin.initializeApp() via ${credentialSource || 'unknown source'}. Error: ${error.message}`);
    }
    console.error(`Firebase Admin SDK: ${initializationError.message}`);
    if (serviceAccount) {
        // Log details helpful for debugging, excluding the private key
        console.error("Firebase Admin SDK: Service Account details used (check project_id, client_email):", { projectId: serviceAccount.project_id, clientEmail: serviceAccount.client_email });
    }
    adminAuthInstance = null; // Ensure instance is null on failure
  }
}

// --- Call Initialization ---
// This ensures initialization logic runs only once when the module is first imported.
try {
    initializeFirebaseAdmin();
} catch (initError: any) {
    // Catch any unexpected synchronous errors during the initial call itself
    console.error(`Firebase Admin SDK: Unexpected error during initial call to initializeFirebaseAdmin: ${initError.message}`);
    initializationError = initializationError || initError; // Preserve original error if one was already set
    adminAuthInstance = null; // Ensure instance is null
}


// --- Export Getter Function ---
/**
 * Gets the initialized Firebase Admin Auth instance.
 * Throws an error if the SDK failed to initialize.
 * @returns {admin.auth.Auth} The Firebase Admin Auth instance.
 * @throws {Error} If Firebase Admin SDK initialization failed.
 */
export const getAdminAuth = (): admin.auth.Auth => {
    if (initializationError) {
        // Provide a detailed error message upon access if initialization failed
         throw new Error(`Firebase Admin SDK access failed: ${initializationError.message}. Check server startup logs for details. Common causes are missing, empty, or invalid service account credentials (env var 'FIREBASE_SERVICE_ACCOUNT_KEY' or local file '${serviceAccountFilename}'). Please verify your setup according to the README.md.`);
    }
    if (!adminAuthInstance) {
        // This case signifies a logic error in initialization if reached without initializationError being set.
        // It might also occur if the module was somehow imported *before* initialization completed, though unlikely.
        throw new Error("Firebase Admin SDK was not initialized successfully, but no specific error was recorded. This indicates a potential bug or race condition. Check server logs.");
    }
    return adminAuthInstance;
}

// Export other admin services if needed, e.g., admin.firestore()
// export const adminDb = getAdminDb; // Example: Create a getter for Firestore if needed

// // Example getter for Firestore (if using)
// let adminDbInstance: admin.firestore.Firestore | null = null;
// function initializeFirestore() {
//     if (!adminDbInstance && adminAuthInstance) { // Check if auth is initialized first
//         adminDbInstance = admin.firestore();
//     }
// }
// // Call this after admin init or within the getter
// // initializeFirestore();
//
// export const getAdminDb = (): admin.firestore.Firestore => {
//     if (!adminAuthInstance) { // Check auth dependency
//        getAdminAuth(); // This will throw if auth failed
//     }
//     if (!adminDbInstance) {
//         initializeFirestore(); // Attempt to initialize
//         if (!adminDbInstance) {
//              throw new Error("Firebase Firestore Admin SDK could not be initialized.");
//         }
//     }
//     return adminDbInstance;
// }
