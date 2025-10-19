-- Make CVs bucket public so anyone can view uploaded CVs
UPDATE storage.buckets 
SET public = true 
WHERE id = 'cvs';