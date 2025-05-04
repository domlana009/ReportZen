
'use server';

import { getAdminAuth } from '@/lib/firebase/admin'; // Import the getter function
import type { UserRecord } from 'firebase-admin/auth';

// Define return type
interface ListUsersResult {
  success: boolean;
  message: string;
  users?: {
    uid: string;
    email: string | undefined; // Email might be undefined
    creationTime: string;
    lastSignInTime: string;
    disabled: boolean;
    isAdmin: boolean; // Added isAdmin flag
    allowedSections: string[]; // Added allowed sections
  }[];
}

export async function listUsersAction(): Promise<ListUsersResult> {
  try {
     const adminAuth = getAdminAuth(); // Get the admin auth instance inside try block

    // --- Authentication/Authorization Check ---
    // Ensure the caller is an admin. This logic should be robust.
    // Assuming page-level protection or token verification happens before calling this action.
    // --- End Auth Check ---

    const listUsersResult = await adminAuth.listUsers(1000); // List up to 1000 users

    const users = listUsersResult.users.map((userRecord: UserRecord) => {
        // Check for the admin custom claim
        const isAdmin = !!userRecord.customClaims?.admin || (process.env.NEXT_PUBLIC_ADMIN_UID && userRecord.uid === process.env.NEXT_PUBLIC_ADMIN_UID);

        // Get allowed sections claim, default to empty array if missing or invalid
        const allowedSections = Array.isArray(userRecord.customClaims?.allowedSections)
                                  ? userRecord.customClaims?.allowedSections as string[]
                                  : [];

        return {
            uid: userRecord.uid,
            email: userRecord.email,
            creationTime: userRecord.metadata.creationTime,
            lastSignInTime: userRecord.metadata.lastSignInTime,
            disabled: userRecord.disabled,
            isAdmin: isAdmin,
            allowedSections: allowedSections, // Include allowed sections
        };
    });

    // Optionally sort users, e.g., by creation time or email
    users.sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());

    return {
      success: true,
      message: `Successfully fetched ${users.length} users.`,
      users: users,
    };
  } catch (error: any) {
    // Catch errors from getAdminAuth (SDK init failure) or adminAuth.listUsers()
    console.error('Error listing users:', error);
    let errorMessage = `Erreur lors de la récupération des utilisateurs: ${error.message}`;
     // Check if the error message indicates an SDK initialization failure from the getter
    if (error.message?.includes("Firebase Admin SDK access failed")) {
        errorMessage = `Erreur critique: Impossible d'initialiser Firebase Admin SDK. Vérifiez les logs du serveur. (${error.message})`;
    }

    return {
        success: false,
        message: errorMessage,
    };
  }
}
