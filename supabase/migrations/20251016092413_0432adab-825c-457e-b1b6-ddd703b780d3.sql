-- Add write protection policies to candidate_matches table
-- Only the system (via edge functions with service role) should be able to write match records
-- Users should never directly insert, update, or delete matches

-- Policy to block all user inserts
CREATE POLICY "Only system can insert matches" 
ON candidate_matches 
FOR INSERT 
WITH CHECK (false);

-- Policy to block all user updates
CREATE POLICY "Only system can update matches" 
ON candidate_matches 
FOR UPDATE 
USING (false);

-- Policy to block all user deletes
CREATE POLICY "Only system can delete matches" 
ON candidate_matches 
FOR DELETE 
USING (false);