import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { candidateId } = await req.json().catch(() => ({}));

    // Validate candidateId if provided - must match authenticated user or user must be recruiter
    if (candidateId && candidateId !== user.id) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "RECRUITER")
        .single();
      
      if (!roleData) {
        return new Response(
          JSON.stringify({ error: "Unauthorized to trigger matching for other users" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch candidates to match
    const candidatesQuery = candidateId
      ? supabase.from("candidate_profiles").select("*").eq("user_id", candidateId)
      : supabase.from("candidate_profiles").select("*");

    const { data: candidates, error: candidatesError } = await candidatesQuery;
    if (candidatesError) throw candidatesError;

    // Fetch active jobs
    const { data: jobs, error: jobsError } = await supabase
      .from("job_positions")
      .select("*")
      .eq("is_active", true);

    if (jobsError) throw jobsError;

    // Load synonym map from database
    const { data: synonymData, error: synonymError } = await supabase
      .from('skill_synonyms')
      .select('term, synonyms');
    
    if (synonymError) {
      console.error('Error loading synonym map:', synonymError);
    }
    
    const synonymDatabase: Record<string, string[]> = {};
    const reverseIndex: Record<string, string[]> = {}; // Maps synonym -> [original terms]
    
    for (const row of synonymData || []) {
      synonymDatabase[row.term] = row.synonyms;
      
      // Build reverse index for bidirectional lookup
      for (const synonym of row.synonyms) {
        const normalizedSyn = synonym.toLowerCase().trim();
        if (!reverseIndex[normalizedSyn]) {
          reverseIndex[normalizedSyn] = [];
        }
        reverseIndex[normalizedSyn].push(row.term);
      }
    }
    
    console.log(`Loaded ${Object.keys(synonymDatabase).length} synonym terms from database`);

    // Helper function to get all related terms (bidirectional synonym lookup)
    const getRelatedTerms = (word: string): string[] => {
      const normalized = word.toLowerCase().trim();
      const related = new Set<string>();
      
      // Add direct synonyms
      const directSynonyms = synonymDatabase[normalized] || [];
      directSynonyms.forEach(s => related.add(s.toLowerCase()));
      
      // Add reverse lookup - if this word is a synonym, add the original terms
      const originalTerms = reverseIndex[normalized] || [];
      originalTerms.forEach(t => {
        related.add(t.toLowerCase());
        // Also add all synonyms of those terms
        const synonymsOfTerm = synonymDatabase[t] || [];
        synonymsOfTerm.forEach(s => related.add(s.toLowerCase()));
      });
      
      return Array.from(related);
    };

    // Helper function for fuzzy matching (handles plurals and close variants)
    const fuzzyMatch = (word: string, text: string): boolean => {
      const normalized = word.toLowerCase().trim();
      
      // Exact match
      const exactRegex = new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (exactRegex.test(text)) return true;
      
      // Try with/without 's' for plurals
      const withoutS = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized + 's';
      const pluralRegex = new RegExp(`\\b${withoutS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pluralRegex.test(text)) return true;
      
      // Try with/without common suffixes
      const stem = normalized.replace(/(ing|ed|er|s|ment|tion|ly)$/i, '');
      if (stem.length > 2) {
        const stemRegex = new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w{0,4}\\b`, 'i');
        if (stemRegex.test(text)) return true;
      }
      
      return false;
    };

    // Calculate matches with separate scoring for title, skills, and description
    for (const candidate of candidates || []) {
      // Skip candidates without CV text
      if (!candidate.cv_text || candidate.cv_text.trim() === "") {
        console.log(`Skipping candidate ${candidate.user_id} - no CV text`);
        continue;
      }

      const candidateMatches = [];

      for (const job of jobs || []) {
        const cvText = candidate.cv_text.toLowerCase();
        const jobTitle = job.title.toLowerCase();
        const jobSkills = job.required_skills.map((s: string) => s.toLowerCase().trim());
        const jobDescription = (job.description || '').toLowerCase();

        // Helper to calculate match percentage for a set of terms
        const calculateMatchPercentage = (terms: string[]): number => {
          if (terms.length === 0) return 0;
          
          let matchedCount = 0;
          let totalWeight = 0;
          
          for (const term of terms) {
            const termWords = term.split(/\s+/).filter((w: string) => w.length > 2);
            let termScore = 0;
            totalWeight += 10;
            
            // Exact phrase match (10 points)
            const exactRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (exactRegex.test(cvText)) {
              termScore = 10;
            }
            // All words present (8 points)
            else if (termWords.length > 1 && termWords.every((w: string) => {
              const wordRegex = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
              return wordRegex.test(cvText);
            })) {
              termScore = 8;
            }
            // Fuzzy/stemmed match (6 points)
            else if (termWords.some((w: string) => fuzzyMatch(w, cvText))) {
              termScore = 6;
            }
            // Synonym match (5 points)
            else {
              for (const word of termWords) {
                if (word.length > 2) {
                  const relatedTerms = getRelatedTerms(word);
                  if (relatedTerms.some((r: string) => fuzzyMatch(r, cvText))) {
                    termScore = 5;
                    console.log(`Synonym match: "${word}" found via related terms`);
                    break;
                  }
                }
              }
            }
            
            matchedCount += termScore;
          }
          
          return totalWeight > 0 ? (matchedCount / totalWeight) * 100 : 0;
        };

        // 1. Title matching (30% weight)
        const titleWords = jobTitle.split(/\s+/).filter((w: string) => w.length > 2);
        const titleScore = calculateMatchPercentage(titleWords);
        
        // 2. Skills matching (50% weight)
        const skillsScore = calculateMatchPercentage(jobSkills);
        
        // 3. Description matching (20% weight) - extract key terms
        const descriptionTerms = jobDescription
          .split(/[.,;!?]\s+/)
          .slice(0, 5) // Take first 5 sentences/phrases
          .flatMap((phrase: string) => {
            const words = phrase.split(/\s+/).filter((w: string) => w.length > 3);
            return words.slice(0, 3); // Take up to 3 significant words per phrase
          })
          .filter((w: string, i: number, arr: string[]) => arr.indexOf(w) === i); // Unique only
        
        const descriptionScore = calculateMatchPercentage(descriptionTerms);
        
        // Combine weighted scores
        const matchScore = Math.round(
          (titleScore * 0.30) + 
          (skillsScore * 0.50) + 
          (descriptionScore * 0.20)
        );
        
        // Ensure score is within valid range
        const finalScore = Math.max(0, Math.min(100, matchScore));
        
        console.log(`Candidate ${candidate.user_id} vs Job ${job.id} (${job.title}):`, {
          titleScore: Math.round(titleScore),
          skillsScore: Math.round(skillsScore),
          descriptionScore: Math.round(descriptionScore),
          finalScore
        });

        candidateMatches.push({
          job_id: job.id,
          match_score: finalScore
        });
      }

      // Check if any scores are >= 60
      const hasHighScore = candidateMatches.some(m => m.match_score >= 60);
      
      if (hasHighScore) {
        // Use existing logic: only save matches >= 60
        for (const match of candidateMatches) {
          if (match.match_score >= 60) {
            await supabase.from("candidate_matches").upsert({
              candidate_id: candidate.user_id,
              job_id: match.job_id,
              match_score: match.match_score,
            }, { onConflict: "candidate_id,job_id" });
          } else {
            // Delete low-score matches if they exist
            await supabase.from("candidate_matches").delete()
              .eq("candidate_id", candidate.user_id)
              .eq("job_id", match.job_id);
          }
        }
      } else {
        // All scores below 60 - apply new logic
        const bestScore = Math.max(...candidateMatches.map(m => m.match_score));
        const marginThreshold = bestScore - 10;
        
        // Filter matches within 10-point margin
        const matchesInMargin = candidateMatches.filter(m => m.match_score >= marginThreshold);
        
        // If multiple positions within margin, take top 5%
        let matchesToSave = matchesInMargin;
        if (matchesInMargin.length > 1) {
          // Sort by score descending
          matchesInMargin.sort((a, b) => b.match_score - a.match_score);
          // Take top 5%, minimum 1
          const topCount = Math.max(1, Math.ceil(matchesInMargin.length * 0.05));
          matchesToSave = matchesInMargin.slice(0, topCount);
        }
        
        // Save the selected matches and delete others
        for (const match of candidateMatches) {
          if (matchesToSave.some(m => m.job_id === match.job_id)) {
            await supabase.from("candidate_matches").upsert({
              candidate_id: candidate.user_id,
              job_id: match.job_id,
              match_score: match.match_score,
            }, { onConflict: "candidate_id,job_id" });
          } else {
            await supabase.from("candidate_matches").delete()
              .eq("candidate_id", candidate.user_id)
              .eq("job_id", match.job_id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Matching complete" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in match-candidates:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
