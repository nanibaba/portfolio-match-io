import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Calendar, Users } from "lucide-react";
import JobMatchesDialog from "@/components/JobMatchesDialog";

interface Job {
  id: string;
  title: string;
  description: string;
  required_skills: string[];
  employment_type: string;
  created_at: string;
}

interface JobsListProps {
  onRefresh: () => void;
}

export default function JobsList({ onRefresh }: JobsListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("recruiter_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading jobs...</div>;
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No jobs posted yet</h3>
          <p className="text-muted-foreground">
            Click "Post New Job" to create your first job posting
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {jobs.map((job) => (
          <Card key={job.id} className="hover:shadow-[var(--shadow-medium)] transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{job.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Calendar className="h-4 w-4" />
                    Posted {new Date(job.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm line-clamp-2">{job.description}</p>

              <div className="flex flex-wrap gap-2">
                {job.required_skills.slice(0, 3).map((skill, index) => (
                  <Badge key={index} variant="secondary">
                    {skill}
                  </Badge>
                ))}
                {job.required_skills.length > 3 && (
                  <Badge variant="secondary">+{job.required_skills.length - 3} more</Badge>
                )}
              </div>

              <div className="flex items-center justify-between pt-4">
                <Badge variant="outline">
                  {job.employment_type}
                </Badge>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <Users className="mr-2 h-4 w-4" />
                  View Matches
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedJobId && (
        <JobMatchesDialog
          jobId={selectedJobId}
          open={!!selectedJobId}
          onOpenChange={(open) => !open && setSelectedJobId(null)}
        />
      )}
    </>
  );
}
