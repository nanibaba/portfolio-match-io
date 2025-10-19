import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileText, LogOut, Upload } from "lucide-react";
import CandidateMatches from "@/components/CandidateMatches";
import { candidateProfileSchema } from "@/lib/validation";
import { type TextItem } from "pdfjs-dist/types/src/display/api";

interface CandidateDashboardProps {
  user: User;
}

export default function CandidateDashboard({ user }: CandidateDashboardProps) {
  const [hasProfile, setHasProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const checkProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("candidate_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setHasProfile(true);
      }
    } catch (error) {
      console.error("Error checking profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validationResult = candidateProfileSchema.safeParse({
        fullName,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
      }

      if (!cvFile) {
        throw new Error("Please upload your CV");
      }

      let cvUrl = null;
      let cvText = "";

      // Extract text from PDF
      const arrayBuffer = await cvFile.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      
      // Use the worker from npm package instead of CDN
      const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const textParts = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: TextItem) => item.str).join(" ");
        textParts.push(pageText);
      }
      
      cvText = textParts.join("\n");

      // Upload CV
      const fileExt = cvFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("cvs")
        .upload(fileName, cvFile);

      if (uploadError) throw uploadError;

      cvUrl = fileName;

      const { error } = await supabase.from("candidate_profiles").insert({
        user_id: user.id,
        full_name: fullName,
        cv_url: cvUrl,
        cv_text: cvText,
      });

      if (error) throw error;

      // Trigger matching with authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.functions.invoke("match-candidates", {
          body: { candidateId: user.id },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }

      setHasProfile(true);
      toast({
        title: "Profile created!",
        description: "We're matching you with relevant job positions.",
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const triggerMatching = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.functions.invoke("match-candidates", {
          body: { candidateId: user.id },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        toast({
          title: "Matching refreshed!",
          description: "We've updated your job matches.",
        });
        // Refresh the page to show new matches
        window.location.reload();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!hasProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary to-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-end mb-6">
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>

          <Card className="shadow-[var(--shadow-medium)]">
            <CardHeader>
              <CardTitle>Complete Your Candidate Profile</CardTitle>
              <CardDescription>
                Tell us about your skills and experience to get matched with jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createProfile} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Upload CV (PDF) *</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("cv-upload")?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Choose File
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {cvFile ? cvFile.name : "No file selected"}
                    </span>
                  </div>
                  <input
                    id="cv-upload"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" variant="gradient" disabled={loading}>
                  Create Profile & Find Matches
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">PortfolioIO</h1>
              <p className="text-sm text-muted-foreground">Candidate Portal</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Your Matched Positions</h2>
            <p className="text-muted-foreground">
              Jobs that match your skills and experience
            </p>
          </div>
          <Button onClick={triggerMatching} variant="outline">
            Refresh Matches
          </Button>
        </div>

        <CandidateMatches candidateId={user.id} />
      </main>
    </div>
  );
}
