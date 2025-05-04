
"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth'; // Corrected extension
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as CardDesc } from '@/components/ui/card'; // Renamed CardDescription to avoid conflict
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import Link from 'next/link';
import { listUsersAction } from '@/actions/list-users';
import { setUserRoleAction } from '@/actions/set-user-role'; // Import new action
import { toggleUserStatusAction } from '@/actions/toggle-user-status'; // Import new action
import { deleteUserAction } from '@/actions/delete-user'; // Import new action
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge'; // For displaying role/status
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription, // Renamed AlertDialogDescription to avoid conflict
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ShieldCheck, ShieldOff, UserCog, Trash2, Ban, CheckCircle, Plus, KeyRound, Loader2, AlertCircle } from 'lucide-react'; // Icons + Loader
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'; // Dropdown for actions
import { UserPermissionsDialog } from '@/components/admin/user-permissions-dialog'; // Import the new dialog component
import { Alert, AlertDescription } from '@/components/ui/alert'; // Import Alert and AlertDescription


// Define a type for the user data we expect from the action
interface DisplayUser {
  uid: string;
  email: string | undefined;
  creationTime: string;
  lastSignInTime: string;
  disabled: boolean;
  isAdmin: boolean;
  allowedSections: string[]; // Add allowedSections
}

// Define type for the user being edited in the permissions dialog
interface UserBeingEdited {
    uid: string;
    email: string | undefined;
    allowedSections: string[];
}

export default function AdminPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [listError, setListError] = useState<string | null>(null); // State for list errors
  // State for managing the permissions dialog
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [userToEditPermissions, setUserToEditPermissions] = useState<UserBeingEdited | null>(null);


  // Redirect non-admins or unauthenticated users
  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.push('/'); // Redirect to home if not admin
    }
  }, [currentUser, authLoading, router]);

  // Function to fetch users
  const fetchUsers = useCallback(async () => {
      setListLoading(true);
      setListError(null); // Reset error state
      try {
         const result = await listUsersAction();
         if (result.success && result.users) {
           setUsers(result.users);
         } else {
            const errorMessage = result.message || "Erreur inconnue lors de la récupération des utilisateurs.";
            setListError(`Erreur: ${errorMessage}`); // Set detailed error message
            toast({
                title: "Erreur",
                description: errorMessage,
                variant: "destructive",
            });
            console.error("AdminPage: Failed to fetch users:", result.message);
            setUsers([]); // Ensure users list is empty on failure
         }
      } catch (error: any) {
         // Catch errors potentially thrown by getAdminAuth if SDK init fails
         const errorMessage = error.message || "Une erreur serveur est survenue lors de la récupération des utilisateurs.";
         setListError(`Erreur critique: Impossible d'initialiser Firebase Admin SDK. Vérifiez les logs du serveur. (${errorMessage})`);
         toast({
             title: "Erreur Critique",
             description: `Impossible de charger la liste des utilisateurs. Problème de configuration serveur. Détails: ${errorMessage}`,
             variant: "destructive",
         });
         console.error("AdminPage: Critical error fetching users (likely SDK init failure):", error);
         setUsers([]);
      } finally {
         setListLoading(false);
      }
  }, [toast]);


  // Fetch users when the component mounts and user is confirmed as admin
  useEffect(() => {
    // Ensure auth loading is complete and user is admin before fetching
    if (!authLoading && currentUser?.role === 'admin') {
        fetchUsers();
    }
  }, [currentUser, authLoading, fetchUsers]); // Include fetchUsers in dependency array


  // --- Action Handlers ---

  const handleSetAdmin = (uid: string, isAdmin: boolean) => {
    startTransition(async () => {
        const result = await setUserRoleAction(uid, isAdmin);
        toast({
            title: result.success ? "Succès" : "Erreur",
            description: result.message,
            variant: result.success ? "default" : "destructive",
        });
        if (result.success) {
            fetchUsers(); // Refresh user list
        }
    });
  };

  const handleToggleStatus = (uid: string, isDisabled: boolean) => {
     startTransition(async () => {
        const result = await toggleUserStatusAction(uid, isDisabled);
        toast({
            title: result.success ? "Succès" : "Erreur",
            description: result.message,
            variant: result.success ? "default" : "destructive",
        });
         if (result.success) {
            fetchUsers(); // Refresh user list
        }
     });
  };

  const handleDeleteUser = (uid: string) => {
     startTransition(async () => {
        const result = await deleteUserAction(uid);
        toast({
            title: result.success ? "Succès" : "Erreur",
            description: result.message,
            variant: result.success ? "default" : "destructive",
        });
         if (result.success) {
            fetchUsers(); // Refresh user list
        }
     });
  };

   // Handler to open the permissions dialog
    const openPermissionsDialog = (user: DisplayUser) => {
        setUserToEditPermissions({
            uid: user.uid,
            email: user.email,
            allowedSections: user.allowedSections,
        });
        setIsPermissionsDialogOpen(true);
    };

    // Handler called when permissions are updated in the dialog
    const handlePermissionsUpdate = () => {
        fetchUsers(); // Re-fetch users to reflect changes
    };

  // --- Rendering Logic ---

  if (authLoading || !currentUser || currentUser.role !== 'admin') {
    return <div className="flex justify-center items-center min-h-screen">Chargement ou redirection...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
             <h1 className="text-3xl font-bold">Panneau d'administration</h1>
            <Link href="/admin/create-user" passHref>
                <Button><Plus className="mr-2 h-4 w-4"/>Créer Utilisateur</Button>
            </Link>
        </div>

        {/* User List Section */}
        <Card>
            <CardHeader>
                <CardTitle>Gestion des Utilisateurs</CardTitle>
                <CardDesc>Gérer les utilisateurs, leurs rôles, leur statut et leurs permissions.</CardDesc> {/* Use renamed CardDesc */}
            </CardHeader>
            <CardContent>
                {listLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : listError ? ( // Display error message if loading failed
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                           {listError} <Button variant="link" onClick={fetchUsers} className="p-0 h-auto ml-2">Réessayer</Button>
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Rôle</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead>Permissions</TableHead>{/* Permissions Column */}
                                    <TableHead>UID</TableHead>
                                    <TableHead>Créé le</TableHead>
                                    <TableHead>Dernière connexion</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.length > 0 ? (
                                    users.map((usr) => (
                                    <TableRow key={usr.uid} className={usr.disabled ? 'opacity-60' : ''}>
                                        <TableCell className="font-medium">{usr.email || 'N/A'}</TableCell>
                                        <TableCell>
                                            {/* Display Admin badge if user is admin */}
                                            {usr.isAdmin || (process.env.NEXT_PUBLIC_ADMIN_UID && usr.uid === process.env.NEXT_PUBLIC_ADMIN_UID) ? (
                                                <Badge variant="secondary"><ShieldCheck className="mr-1 h-3 w-3" /> Admin</Badge>
                                            ) : (
                                                <Badge variant="outline">User</Badge>
                                            )}
                                        </TableCell>
                                         <TableCell>
                                            {usr.disabled ? (
                                                <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" />Désactivé</Badge>
                                            ) : (
                                                <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-1 h-3 w-3" />Activé</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell> {/* Permissions Cell */}
                                            {/* Show number of allowed sections or 'All' for admin */}
                                             {usr.isAdmin || (process.env.NEXT_PUBLIC_ADMIN_UID && usr.uid === process.env.NEXT_PUBLIC_ADMIN_UID) ? (
                                                 <Badge variant="outline">Toutes</Badge>
                                            ) : (
                                                 <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => openPermissionsDialog(usr)}>
                                                    {usr.allowedSections.length} section(s)
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{usr.uid}</TableCell>
                                        <TableCell>{new Date(usr.creationTime).toLocaleDateString()}</TableCell>
                                        <TableCell>{usr.lastSignInTime ? new Date(usr.lastSignInTime).toLocaleDateString() : 'Jamais'}</TableCell>
                                        <TableCell className="text-right">
                                            {/* Prevent modifying the primary admin defined by UID */}
                                            {(process.env.NEXT_PUBLIC_ADMIN_UID && usr.uid === process.env.NEXT_PUBLIC_ADMIN_UID) ? (
                                                 <Badge variant="outline">Principal</Badge>
                                            ) : (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" disabled={isPending}>
                                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
                                                            <span className="sr-only">Actions</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {/* --- Manage Permissions --- */}
                                                         <DropdownMenuItem onSelect={() => openPermissionsDialog(usr)} disabled={isPending}>
                                                            <KeyRound className="mr-2 h-4 w-4" /> Gérer Permissions
                                                         </DropdownMenuItem>

                                                         <DropdownMenuSeparator />


                                                        {/* --- Role Management --- */}
                                                         {usr.isAdmin ? (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isPending}>
                                                                        <ShieldOff className="mr-2 h-4 w-4"/> Retirer Admin
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Retirer le Rôle Admin?</AlertDialogTitle>
                                                                        <AlertDialogDescription> {/* Use renamed AlertDialogDescription */}
                                                                            Confirmez-vous la révocation des privilèges admin pour {usr.email || usr.uid}?
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleSetAdmin(usr.uid, false)} disabled={isPending}>
                                                                            Confirmer
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        ) : (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isPending}>
                                                                        <ShieldCheck className="mr-2 h-4 w-4"/> Définir Admin
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                 <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Définir comme Admin?</AlertDialogTitle>
                                                                        <AlertDialogDescription> {/* Use renamed AlertDialogDescription */}
                                                                            Confirmez-vous l'attribution des privilèges admin à {usr.email || usr.uid}?
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleSetAdmin(usr.uid, true)} disabled={isPending}>
                                                                            Confirmer
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}

                                                        {/* --- Status Management --- */}
                                                         {usr.disabled ? (
                                                             <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isPending}>
                                                                        <CheckCircle className="mr-2 h-4 w-4"/> Activer
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Activer l'Utilisateur?</AlertDialogTitle>
                                                                        <AlertDialogDescription> {/* Use renamed AlertDialogDescription */}
                                                                            Confirmez-vous l'activation du compte pour {usr.email || usr.uid}?
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleToggleStatus(usr.uid, false)} disabled={isPending}>
                                                                            Confirmer
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        ) : (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isPending} className="text-destructive focus:text-destructive">
                                                                        <Ban className="mr-2 h-4 w-4"/> Désactiver
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                 <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Désactiver l'Utilisateur?</AlertDialogTitle>
                                                                        <AlertDialogDescription> {/* Use renamed AlertDialogDescription */}
                                                                             Confirmez-vous la désactivation du compte pour {usr.email || usr.uid}? L'utilisateur ne pourra plus se connecter.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
                                                                        {/* Use Button component for destructive action */}
                                                                        <Button
                                                                            variant="destructive"
                                                                            onClick={() => handleToggleStatus(usr.uid, true)}
                                                                            disabled={isPending}
                                                                        >
                                                                            Désactiver
                                                                        </Button>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}

                                                        {/* --- Delete User --- */}
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isPending} className="text-destructive focus:text-destructive">
                                                                    <Trash2 className="mr-2 h-4 w-4"/> Supprimer
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Supprimer l'Utilisateur?</AlertDialogTitle>
                                                                    <AlertDialogDescription> {/* Use renamed AlertDialogDescription */}
                                                                        Cette action est irréversible. Confirmez-vous la suppression définitive de {usr.email || usr.uid}?
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
                                                                     {/* Use Button component for destructive action */}
                                                                    <Button
                                                                        variant="destructive"
                                                                        onClick={() => handleDeleteUser(usr.uid)}
                                                                        disabled={isPending}
                                                                    >
                                                                        Supprimer
                                                                    </Button>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-muted-foreground"> {/* Adjusted colSpan */}
                                            Aucun utilisateur trouvé.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Permissions Dialog */}
        {userToEditPermissions && (
             <UserPermissionsDialog
                open={isPermissionsDialogOpen}
                onOpenChange={setIsPermissionsDialogOpen}
                userId={userToEditPermissions.uid}
                userEmail={userToEditPermissions.email}
                currentAllowedSections={userToEditPermissions.allowedSections}
                onPermissionsUpdate={handlePermissionsUpdate}
             />
        )}
    </div>
  );
}
