import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { jobSchema } from "@/lib/validation";

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function CreateJobDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateJobDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [employmentType, setEmploymentType] = useState<"full-time" | "part-time" | "contract" | "internship">("full-time");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validationResult = jobSchema.safeParse({
        title,
        description,
        requiredSkills,
        employmentType,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const skillsArray = requiredSkills.split(",").map((s) => s.trim()).filter(Boolean);

      const { error } = await supabase.from("job_positions").insert({
        recruiter_id: user.id,
        title,
        description,
        required_skills: skillsArray,
        employment_type: employmentType,
      });

      if (error) throw error;

      // Trigger matching for this new job (with authentication)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.functions.invoke("match-candidates", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }

      toast({
        title: "Job posted!",
        description: "Your job posting is now live and being matched with candidates.",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setRequiredSkills("");
      setEmploymentType("full-time");

      onSuccess();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post a New Job</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a job posting
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Senior React Developer"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Job Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role, responsibilities, and requirements"
              rows={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skills">Required Skills (comma-separated)</Label>
            <Input
              id="skills"
              value={requiredSkills}
              onChange={(e) => setRequiredSkills(e.target.value)}
              placeholder="React, TypeScript, Node.js, etc."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="employment">Employment Type</Label>
            <select
              id="employment"
              className="w-full p-2 border rounded-md"
              value={employmentType}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(e) => setEmploymentType(e.target.value as any)}
            >
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={loading}>
              {loading ? "Creating..." : "Post Job"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
