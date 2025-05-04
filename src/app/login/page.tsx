
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config'; // Adjust path as necessary
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast"; // Import useToast

export default function LoginPage() {
  const [userEmail, setUserEmail] = useState(''); // State for user input (email format)
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast(); // Initialize useToast

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Ensure auth is initialized
    if (!auth) {
        const authErrorMsg = "Erreur d'initialisation de l'authentification. Vérifiez la configuration Firebase.";
        setError(authErrorMsg);
        toast({ title: "Erreur", description: authErrorMsg, variant: "destructive" });
        setLoading(false);
        return;
    }

    try {
      // Use userEmail state variable for login
      await signInWithEmailAndPassword(auth, userEmail, password);
      toast({ // Show success toast
        title: "Connexion réussie",
        description: "Vous allez être redirigé.",
      });
      router.push('/'); // Redirect to home page on successful login
    } catch (err: any) {
      console.error("Login failed:", err);
      let errorMessage = "Échec de la connexion. Veuillez vérifier vos identifiants.";
      // Provide more specific messages based on Firebase error codes
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        // This error often means the user doesn't exist or the password is wrong.
        // Double-check that the user (e.g., j.abbay@admin.com) has been manually created in the Firebase Console
        // with the correct password (e.g., 123456).
        errorMessage = "Identifiants invalides. Vérifiez votre email et mot de passe, ou assurez-vous que l'utilisateur existe."; // Updated message for invalid credential
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Format d'email invalide.";
      } else if (err.code === 'auth/invalid-api-key' || err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
         errorMessage = "Erreur de configuration : Clé API Firebase invalide.";
      } else if (err.code === 'auth/missing-password') {
         errorMessage = "Mot de passe manquant.";
      }
      setError(errorMessage);
       toast({ // Show error toast
        title: "Erreur de connexion",
        description: errorMessage,
        variant: "destructive",
      });
      setLoading(false);
    }
    // No need to set loading false here if redirecting on success
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Connexion</CardTitle>
          <CardDescription className="text-center">Connectez-vous à votre compte R0</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {/* Changed Label text back to User as requested */}
              <Label htmlFor="email">User</Label>
              <Input
                id="email"
                type="email" // Keep type as email for Firebase Auth compatibility
                placeholder="utilisateur@example.com" // Keep placeholder example format
                required
                value={userEmail} // Use userEmail state variable
                onChange={(e) => setUserEmail(e.target.value)} // Use setUserEmail setter
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
