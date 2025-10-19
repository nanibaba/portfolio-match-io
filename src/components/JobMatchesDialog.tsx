import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Users } from "lucide-react";

interface Match {
  id: string;
  match_score: number;
  candidate_profiles: {
    full_name: string;
    cv_url: string | null;
  };
}

interface JobMatchesDialogProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function JobMatchesDialog({
  jobId,
  open,
  onOpenChange,
}: JobMatchesDialogProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobTitle, setJobTitle] = useState("");
  const [cvUrls, setCvUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && jobId) {
      fetchMatches();

      // Subscribe to real-time updates for new matches
      const channel = supabase
        .channel(`job-matches-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'candidate_matches',
            filter: `job_id=eq.${jobId}`,
          },
          () => {
            // Refetch matches when a new match is inserted
            fetchMatches();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);

  const fetchMatches = async () => {
    try {
      // Fetch job title
      const { data: jobData } = await supabase
        .from("job_positions")
        .select("title")
        .eq("id", jobId)
        .single();

      if (jobData) setJobTitle(jobData.title);

      // Fetch matches
      const { data, error } = await supabase
        .from("candidate_matches")
        .select(`
          id,
          match_score,
          candidate_profiles (
            full_name,
            cv_url
          )
        `)
        .eq("job_id", jobId)
        .order("match_score", { ascending: false });

      if (error) throw error;

      setMatches(data || []);

      // Generate signed URLs for CVs
      const urls: Record<string, string> = {};
      for (const match of data || []) {
        if (match.candidate_profiles?.cv_url) {
          const { data: signedUrlData } = await supabase.storage
            .from("cvs")
            .createSignedUrl(match.candidate_profiles.cv_url, 3600); // 1 hour expiry
          
          if (signedUrlData?.signedUrl) {
            urls[match.id] = signedUrlData.signedUrl;
          }
        }
      }
      setCvUrls(urls);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Matched Candidates for {jobTitle}</DialogTitle>
          <DialogDescription>
            Candidates automatically matched based on CV content
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">Loading matches...</div>
        ) : matches.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No matches yet</h3>
            <p className="text-muted-foreground">
              Candidates will appear here as they submit their profiles
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <Card key={match.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {match.candidate_profiles.full_name}
                      </CardTitle>
                      <Badge
                        variant={
                          match.match_score >= 75
                            ? "default"
                            : match.match_score >= 50
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {match.match_score}% match
                      </Badge>
                    </div>
                    {match.candidate_profiles.cv_url && cvUrls[match.id] && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={cvUrls[match.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          View CV
                        </a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Review the candidate's CV to assess their qualifications and experience.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
