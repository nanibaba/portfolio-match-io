import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, LogOut, Plus, Users } from "lucide-react";
import CreateJobDialog from "@/components/CreateJobDialog";
import JobsList from "@/components/JobsList";
import { recruiterProfileSchema } from "@/lib/validation";

interface RecruiterDashboardProps {
  user: User;
}

export default function RecruiterDashboard({ user }: RecruiterDashboardProps) {
  const [hasProfile, setHasProfile] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    checkProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const checkProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("recruiter_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setHasProfile(true);
        setCompanyName(data.company_name);
        setContactInfo(data.contact_info || "");
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
      const validationResult = recruiterProfileSchema.safeParse({
        companyName,
        contactInfo,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
      }

      const { error } = await supabase.from("recruiter_profiles").insert({
        user_id: user.id,
        company_name: companyName,
        contact_info: contactInfo,
      });

      if (error) throw error;

      setHasProfile(true);
      toast({
        title: "Profile created!",
        description: "You can now start posting jobs.",
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
              <CardTitle>Complete Your Recruiter Profile</CardTitle>
              <CardDescription>
                Tell us about your company to start posting jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createProfile} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Company Name</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact Information</label>
                  <textarea
                    className="w-full p-2 border rounded-md"
                    rows={3}
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="Email, phone, or other contact details"
                  />
                </div>

                <Button type="submit" className="w-full" variant="gradient">
                  Create Profile
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
              <Briefcase className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">PortfolioIO</h1>
              <p className="text-sm text-muted-foreground">{companyName}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">Your Job Positions</h2>
            <p className="text-muted-foreground">Manage your job postings and view matched candidates</p>
          </div>
          <Button onClick={() => setShowCreateJob(true)} variant="gradient">
            <Plus className="mr-2 h-4 w-4" />
            Post New Job
          </Button>
          </div>

          <JobsList key={refreshKey} onRefresh={() => setRefreshKey(prev => prev + 1)} />
      </main>

      <CreateJobDialog
        open={showCreateJob}
        onOpenChange={setShowCreateJob}
        onSuccess={() => {
          setShowCreateJob(false);
          setRefreshKey(prev => prev + 1);
        }}
      />
    </div>
  );
}
