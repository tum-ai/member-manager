begin;

-- =========================================================================
-- Beacon canonical seed vocabularies.
--
-- Starter data so entity resolution + set-membership queries work out of the
-- box: a controlled capability-tag list (FK target for beacon_person_tag), and
-- a handful of well-known organizations/schools pre-tagged so queries like
-- "worked at a big tech company" or "US Ivy League degree" resolve immediately.
-- Enrichment grows these tables further; these rows are the anchors.
--
-- Idempotent: ON CONFLICT keeps re-runs / `supabase db reset` clean.
-- canonical_key = lowercased name (the resolver normalizes the same way).
-- =========================================================================

-- ---- Capability tag vocabulary ---------------------------------------------
insert into "public"."beacon_tag_vocabulary" ("tag", "label", "category", "description") values
    -- seniority
    ('junior',            'Junior',                 'seniority',  'Early-career individual contributor'),
    ('mid_level',         'Mid-level',              'seniority',  'Established individual contributor'),
    ('senior',            'Senior',                 'seniority',  'Senior individual contributor'),
    ('staff_plus',        'Staff+',                 'seniority',  'Staff / principal / distinguished IC'),
    ('lead',              'Lead',                   'seniority',  'Tech lead or team lead'),
    ('manager',           'Manager',                'seniority',  'People manager'),
    ('founder',           'Founder',                'seniority',  'Founded a company or organization'),
    -- domain
    ('ios',               'iOS',                    'domain',     'Apple platform / iOS development'),
    ('android',           'Android',                'domain',     'Android development'),
    ('web_frontend',      'Web Frontend',           'domain',     'Frontend / web UI engineering'),
    ('backend',           'Backend',                'domain',     'Backend / server engineering'),
    ('fullstack',         'Full-stack',             'domain',     'Full-stack engineering'),
    ('ml_ai',             'Machine Learning / AI',  'domain',     'ML / AI / deep learning'),
    ('data_engineering',  'Data Engineering',       'domain',     'Data pipelines / warehousing'),
    ('data_science',      'Data Science',           'domain',     'Analytics / data science'),
    ('devops',            'DevOps / SRE',           'domain',     'Infrastructure / reliability'),
    ('security',          'Security',               'domain',     'Security / cryptography'),
    ('blockchain',        'Blockchain',             'domain',     'Crypto / distributed ledger'),
    ('embedded',          'Embedded',               'domain',     'Embedded / firmware'),
    ('robotics',          'Robotics',               'domain',     'Robotics / control'),
    ('design_ux',         'Design / UX',            'domain',     'Product design / UX'),
    ('product',           'Product Management',     'domain',     'Product management'),
    ('research',          'Research',               'domain',     'Academic / applied research'),
    -- capability
    ('shipped_app_store', 'Shipped App Store app',  'capability', 'Published an app to the Apple App Store'),
    ('shipped_play_store','Shipped Play Store app', 'capability', 'Published an app to the Google Play Store'),
    ('open_source',       'Open-source contributor','capability', 'Maintains or significantly contributes to OSS'),
    ('published_research','Published research',     'capability', 'Author on a peer-reviewed publication'),
    ('startup_founder',   'Startup founder',        'capability', 'Founded a startup'),
    ('hackathon_winner',  'Hackathon winner',       'capability', 'Won a hackathon'),
    ('patent_holder',     'Patent holder',          'capability', 'Named on a patent'),
    ('coreml',            'Core ML',                'capability', 'Shipped on-device ML with Apple Core ML')
on conflict ("tag") do update set
    "label" = excluded."label",
    "category" = excluded."category",
    "description" = excluded."description";

-- ---- Canonical organizations (pre-tagged) ----------------------------------
insert into "public"."beacon_organization" ("name", "canonical_key", "domain", "tags") values
    ('Google',          'google',          'google.com',        array['bigtech', 'faang']),
    ('Apple',           'apple',           'apple.com',         array['bigtech', 'faang']),
    ('Amazon',          'amazon',          'amazon.com',        array['bigtech', 'faang']),
    ('Meta',            'meta',            'meta.com',          array['bigtech', 'faang']),
    ('Netflix',         'netflix',         'netflix.com',       array['bigtech', 'faang']),
    ('Microsoft',       'microsoft',       'microsoft.com',     array['bigtech']),
    ('Nvidia',          'nvidia',          'nvidia.com',        array['bigtech']),
    ('Tesla',           'tesla',           'tesla.com',         array['bigtech']),
    ('OpenAI',          'openai',          'openai.com',        array['bigtech', 'ai_lab']),
    ('Anthropic',       'anthropic',       'anthropic.com',     array['ai_lab']),
    ('DeepMind',        'deepmind',        'deepmind.com',      array['bigtech', 'ai_lab']),
    ('Palantir',        'palantir',        'palantir.com',      array['bigtech']),
    ('Stripe',          'stripe',          'stripe.com',        array['bigtech']),
    ('McKinsey & Company','mckinsey & company','mckinsey.com',  array['consulting', 'mbb']),
    ('Boston Consulting Group','boston consulting group','bcg.com', array['consulting', 'mbb']),
    ('Bain & Company',  'bain & company',  'bain.com',          array['consulting', 'mbb'])
on conflict ("canonical_key") do update set
    "name" = excluded."name",
    "domain" = excluded."domain",
    "tags" = excluded."tags";

-- ---- Canonical schools (pre-grouped) ---------------------------------------
insert into "public"."beacon_school" ("name", "canonical_key", "country", "groups") values
    -- US Ivy League
    ('Harvard University',     'harvard university',     'US', array['ivy_league']),
    ('Yale University',        'yale university',        'US', array['ivy_league']),
    ('Princeton University',   'princeton university',   'US', array['ivy_league']),
    ('Columbia University',    'columbia university',    'US', array['ivy_league']),
    ('Brown University',       'brown university',       'US', array['ivy_league']),
    ('Dartmouth College',      'dartmouth college',      'US', array['ivy_league']),
    ('Cornell University',     'cornell university',     'US', array['ivy_league']),
    ('University of Pennsylvania','university of pennsylvania','US', array['ivy_league']),
    -- Elite US tech (not Ivy, common comparison)
    ('Stanford University',    'stanford university',    'US', array['elite_us']),
    ('Massachusetts Institute of Technology','massachusetts institute of technology','US', array['elite_us']),
    -- Oxbridge
    ('University of Oxford',   'university of oxford',   'UK', array['oxbridge']),
    ('University of Cambridge','university of cambridge','UK', array['oxbridge']),
    -- German TU9 (home turf)
    ('Technical University of Munich','technical university of munich','DE', array['tu9', 'german_excellence']),
    ('RWTH Aachen University', 'rwth aachen university', 'DE', array['tu9']),
    ('Karlsruhe Institute of Technology','karlsruhe institute of technology','DE', array['tu9']),
    ('Ludwig Maximilian University of Munich','ludwig maximilian university of munich','DE', array['german_excellence'])
on conflict ("canonical_key") do update set
    "name" = excluded."name",
    "country" = excluded."country",
    "groups" = excluded."groups";

commit;
