import { z } from "zod";

// Job validation schema
export const jobSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(5000, "Description must be less than 5000 characters"),
  requiredSkills: z.string()
    .min(1, "At least one skill is required")
    .refine(
      (val) => val.split(",").filter(Boolean).length <= 20,
      "Maximum 20 skills allowed"
    )
    .refine(
      (val) => val.split(",").every(s => s.trim().length <= 50),
      "Each skill must be less than 50 characters"
    ),
  employmentType: z.enum(["full-time", "part-time", "contract", "internship"]),
});

// Candidate profile validation schema
export const candidateProfileSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
});

// Recruiter profile validation schema
export const recruiterProfileSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200, "Company name must be less than 200 characters"),
  contactInfo: z.string().max(500, "Contact info must be less than 500 characters").optional(),
});

export type JobFormData = z.infer<typeof jobSchema>;
export type CandidateProfileFormData = z.infer<typeof candidateProfileSchema>;
export type RecruiterProfileFormData = z.infer<typeof recruiterProfileSchema>;
