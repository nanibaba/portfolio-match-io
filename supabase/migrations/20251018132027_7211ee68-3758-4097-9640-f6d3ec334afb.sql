-- Create table for storing job skill synonyms
CREATE TABLE IF NOT EXISTS public.skill_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL UNIQUE,
  synonyms TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.skill_synonyms ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read synonyms (needed for matching algorithm)
CREATE POLICY "Anyone can read skill synonyms"
  ON public.skill_synonyms
  FOR SELECT
  USING (true);

-- Only system can modify synonyms
CREATE POLICY "Only system can modify synonyms"
  ON public.skill_synonyms
  FOR ALL
  USING (false);

-- Create index for faster lookups
CREATE INDEX idx_skill_synonyms_term ON public.skill_synonyms(term);

-- Insert comprehensive synonym mappings (200+ unique terms)
INSERT INTO public.skill_synonyms (term, synonyms, category) VALUES
-- Cleaning & Maintenance
('cleaning', ARRAY['clean', 'cleaner', 'janitor', 'custodian', 'housekeeping', 'sanitation', 'sanitize', 'disinfect'], 'cleaning'),
('maintenance', ARRAY['maintain', 'repair', 'fix', 'upkeep', 'service'], 'maintenance'),
('mopping', ARRAY['mop', 'floor cleaning', 'mop floors', 'wash floors'], 'cleaning'),
('sweeping', ARRAY['sweep', 'broom', 'brush'], 'cleaning'),
('vacuuming', ARRAY['vacuum', 'hoover', 'suction'], 'cleaning'),
('disinfecting', ARRAY['disinfect', 'sanitize', 'sterilize', 'hygiene'], 'cleaning'),
('dusting', ARRAY['dust', 'wipe', 'polish'], 'cleaning'),
('janitor', ARRAY['custodian', 'cleaner', 'housekeeper', 'maintenance worker', 'caretaker'], 'cleaning'),

-- Programming Languages
('javascript', ARRAY['js', 'ecmascript', 'es6', 'es2015', 'node', 'nodejs'], 'programming'),
('typescript', ARRAY['ts', 'typed javascript'], 'programming'),
('python', ARRAY['py', 'python3', 'python2'], 'programming'),
('java', ARRAY['jvm', 'java8', 'java11', 'java17'], 'programming'),
('csharp', ARRAY['c#', 'dotnet', '.net', 'asp.net'], 'programming'),
('php', ARRAY['php7', 'php8'], 'programming'),
('ruby', ARRAY['rb', 'ruby on rails', 'ror', 'rails'], 'programming'),
('golang', ARRAY['go', 'google go'], 'programming'),
('rust', ARRAY['rust-lang'], 'programming'),
('swift', ARRAY['swift ui', 'swiftui'], 'programming'),
('kotlin', ARRAY['kt'], 'programming'),

-- Frameworks
('react', ARRAY['reactjs', 'react.js', 'jsx', 'tsx'], 'framework'),
('angular', ARRAY['angularjs', 'angular2'], 'framework'),
('vue', ARRAY['vuejs', 'vue.js', 'vue3'], 'framework'),
('django', ARRAY['python django'], 'framework'),
('flask', ARRAY['python flask'], 'framework'),
('express', ARRAY['expressjs', 'express.js'], 'framework'),
('spring', ARRAY['spring boot', 'spring framework'], 'framework'),

-- Databases
('sql', ARRAY['structured query language', 'tsql', 't-sql'], 'database'),
('mysql', ARRAY['mariadb'], 'database'),
('postgresql', ARRAY['postgres', 'psql'], 'database'),
('mongodb', ARRAY['mongo', 'nosql', 'document database'], 'database'),
('redis', ARRAY['cache', 'key-value store'], 'database'),
('oracle', ARRAY['oracle db', 'oracle database'], 'database'),
('elasticsearch', ARRAY['elastic', 'elk stack', 'search engine'], 'database'),

-- Cloud & DevOps
('aws', ARRAY['amazon web services', 'amazon aws', 'ec2', 's3'], 'cloud'),
('azure', ARRAY['microsoft azure', 'ms azure'], 'cloud'),
('gcp', ARRAY['google cloud', 'google cloud platform'], 'cloud'),
('docker', ARRAY['containerization', 'containers'], 'devops'),
('kubernetes', ARRAY['k8s', 'container orchestration'], 'devops'),
('jenkins', ARRAY['ci/cd', 'continuous integration'], 'devops'),
('terraform', ARRAY['infrastructure as code', 'iac'], 'devops'),
('git', ARRAY['version control', 'github', 'gitlab', 'bitbucket'], 'devops'),

-- Testing
('testing', ARRAY['qa', 'quality assurance', 'test', 'tester'], 'testing'),
('unit testing', ARRAY['unit tests', 'jest', 'mocha'], 'testing'),
('e2e', ARRAY['end-to-end', 'selenium', 'cypress', 'playwright'], 'testing'),
('automation', ARRAY['test automation', 'automated testing'], 'testing'),

-- Management
('management', ARRAY['manager', 'managing', 'lead', 'leadership'], 'management'),
('project management', ARRAY['pm', 'project manager', 'pmo'], 'management'),
('team lead', ARRAY['team leader', 'tech lead', 'lead developer'], 'management'),
('agile', ARRAY['scrum', 'sprint', 'kanban'], 'management'),

-- Soft Skills
('communication', ARRAY['communicator', 'communicate', 'verbal', 'written'], 'soft-skills'),
('leadership', ARRAY['leader', 'lead', 'mentor', 'mentoring'], 'soft-skills'),
('teamwork', ARRAY['team player', 'collaboration', 'collaborative'], 'soft-skills'),
('problem solving', ARRAY['troubleshooting', 'debugging', 'analytical'], 'soft-skills'),

-- Customer Service
('customer service', ARRAY['customer support', 'client service', 'help desk'], 'customer-service'),
('support', ARRAY['technical support', 'customer support', 'helpdesk'], 'customer-service'),
('sales', ARRAY['selling', 'salesperson', 'sales representative'], 'sales'),

-- Design
('design', ARRAY['designer', 'designing', 'creative'], 'design'),
('ui', ARRAY['user interface', 'interface design'], 'design'),
('ux', ARRAY['user experience', 'usability'], 'design'),
('graphic design', ARRAY['graphics', 'visual design'], 'design'),
('figma', ARRAY['design tool', 'prototyping'], 'design'),
('photoshop', ARRAY['adobe photoshop', 'image editing'], 'design'),

-- Data & Analytics
('data analysis', ARRAY['analytics', 'data analytics', 'analyst'], 'analytics'),
('machine learning', ARRAY['ml', 'ai', 'artificial intelligence'], 'analytics'),
('data science', ARRAY['data scientist', 'ds'], 'analytics'),
('statistics', ARRAY['statistical analysis', 'stats'], 'analytics'),
('excel', ARRAY['microsoft excel', 'spreadsheets'], 'analytics'),

-- Security
('security', ARRAY['cybersecurity', 'infosec', 'information security'], 'security'),
('penetration testing', ARRAY['pen testing', 'ethical hacking'], 'security'),
('encryption', ARRAY['cryptography', 'crypto'], 'security'),

-- Mobile
('mobile', ARRAY['mobile development', 'mobile app'], 'mobile'),
('ios', ARRAY['iphone', 'ipad', 'apple'], 'mobile'),
('android', ARRAY['google android'], 'mobile'),
('react native', ARRAY['rn', 'mobile react'], 'mobile'),
('flutter', ARRAY['dart', 'google flutter'], 'mobile'),

-- Web
('html', ARRAY['html5', 'hypertext markup', 'markup'], 'web'),
('css', ARRAY['css3', 'stylesheets', 'styling'], 'web'),
('sass', ARRAY['scss', 'preprocessor'], 'web'),
('api', ARRAY['rest api', 'restful', 'web service'], 'backend'),
('graphql', ARRAY['graph ql', 'query language'], 'backend'),

-- Operating Systems
('linux', ARRAY['unix', 'ubuntu', 'centos', 'debian'], 'os'),
('windows', ARRAY['microsoft windows', 'win'], 'os'),
('macos', ARRAY['mac os', 'osx'], 'os'),

-- Tools
('vscode', ARRAY['visual studio code', 'vs code'], 'tools'),
('jira', ARRAY['project tracking', 'issue tracking'], 'tools'),
('slack', ARRAY['communication', 'chat'], 'tools'),

-- Marketing
('seo', ARRAY['search engine optimization'], 'marketing'),
('social media', ARRAY['social', 'social marketing'], 'marketing'),

-- Finance
('accounting', ARRAY['accountant', 'bookkeeping', 'financial'], 'finance'),
('budgeting', ARRAY['budget', 'financial planning'], 'finance'),

-- Legal
('legal', ARRAY['law', 'attorney', 'lawyer'], 'legal'),
('contract law', ARRAY['contracts', 'agreements', 'legal agreements'], 'legal'),

-- HR
('hr', ARRAY['human resources', 'personnel'], 'hr'),
('recruitment', ARRAY['recruiting', 'hiring', 'talent acquisition'], 'hr'),
('training', ARRAY['employee training', 'learning and development'], 'hr'),

-- Healthcare
('nursing', ARRAY['nurse', 'rn', 'healthcare'], 'healthcare'),
('medical', ARRAY['medicine', 'healthcare'], 'healthcare'),
('patient care', ARRAY['bedside care', 'clinical'], 'healthcare'),

-- Construction
('construction', ARRAY['building', 'contractor'], 'construction'),
('carpentry', ARRAY['carpenter', 'woodworking'], 'construction'),
('plumbing', ARRAY['plumber', 'pipes'], 'construction'),
('electrical', ARRAY['electrician', 'wiring'], 'construction'),
('welding', ARRAY['welder', 'fabrication'], 'construction'),

-- Transportation
('driving', ARRAY['driver', 'transportation'], 'transportation'),
('delivery', ARRAY['courier', 'shipping'], 'transportation'),

-- Hospitality
('hospitality', ARRAY['hotel', 'tourism'], 'hospitality'),
('chef', ARRAY['cook', 'culinary'], 'hospitality'),
('bartender', ARRAY['mixologist', 'bar'], 'hospitality'),

-- Creative
('photography', ARRAY['photographer', 'photo'], 'creative'),
('videography', ARRAY['video', 'filmmaker'], 'creative'),

-- Languages
('spanish', ARRAY['español', 'castellano'], 'languages'),
('french', ARRAY['français'], 'languages'),

-- Manufacturing
('manufacturing', ARRAY['production', 'assembly'], 'manufacturing'),

-- Documentation
('documentation', ARRAY['technical writing', 'docs'], 'documentation'),

-- Gaming
('game development', ARRAY['game dev', 'gaming'], 'gaming'),
('unity', ARRAY['unity3d', 'game engine'], 'gaming'),

-- Embedded
('embedded', ARRAY['embedded systems', 'firmware'], 'embedded'),
('iot', ARRAY['internet of things', 'connected devices'], 'iot'),

-- Networking
('networking', ARRAY['network', 'cisco', 'network engineer'], 'networking'),
('vpn', ARRAY['virtual private network'], 'networking'),

-- Monitoring
('monitoring', ARRAY['observability', 'metrics'], 'monitoring'),
('logging', ARRAY['logs', 'log management'], 'monitoring'),

-- Work Style
('remote', ARRAY['remote work', 'work from home', 'wfh'], 'work-style'),
('full-time', ARRAY['fulltime', 'ft'], 'employment'),
('part-time', ARRAY['parttime', 'pt'], 'employment'),

-- Seniority
('junior', ARRAY['entry-level', 'entry level'], 'seniority'),
('senior', ARRAY['sr', 'senior level'], 'seniority'),
('principal', ARRAY['staff', 'architect'], 'seniority');