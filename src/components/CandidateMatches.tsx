import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Building } from "lucide-react";

interface Match {
  id: string;
  match_score: number;
  job_positions: {
    title: string;
    description: string;
    required_skills: string[];
    employment_type: string;
    recruiter_profiles: {
      company_name: string;
    } | null;
  };
}

interface CandidateMatchesProps {
  candidateId: string;
}

export default function CandidateMatches({ candidateId }: CandidateMatchesProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();

    // Subscribe to real-time updates for new matches
    const channel = supabase
      .channel('candidate-matches')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'candidate_matches',
          filter: `candidate_id=eq.${candidateId}`,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from("candidate_matches")
        .select(`
          id,
          match_score,
          job_positions (
            title,
            description,
            required_skills,
            employment_type,
            recruiter_profiles (
              company_name
            )
          )
        `)
        .eq("candidate_id", candidateId)
        .order("match_score", { ascending: false });

      if (error) throw error;

      setMatches(data || []);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading matches...</div>;
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No matches yet</h3>
          <p className="text-muted-foreground">
            We'll notify you when positions matching your profile become available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {matches.map((match) => (
        <Card key={match.id} className="hover:shadow-[var(--shadow-medium)] transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle>{match.job_positions.title}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Building className="h-4 w-4" />
                  {match.job_positions.recruiter_profiles?.company_name || "Company not specified"}
                </CardDescription>
              </div>
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
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm line-clamp-3">{match.job_positions.description}</p>

            <div className="flex flex-wrap gap-2">
              {match.job_positions.required_skills.slice(0, 3).map((skill, index) => (
                <Badge key={index} variant="secondary">
                  {skill}
                </Badge>
              ))}
              {match.job_positions.required_skills.length > 3 && (
                <Badge variant="secondary">
                  +{match.job_positions.required_skills.length - 3} more
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              <Badge variant="outline">{match.job_positions.employment_type}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
