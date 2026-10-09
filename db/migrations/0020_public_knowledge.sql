CREATE TABLE brand_public_knowledge_versions (
  brand_id text PRIMARY KEY REFERENCES brands(id), revision integer NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE TABLE brand_public_facts (
  id text PRIMARY KEY, brand_id text NOT NULL REFERENCES brands(id), semantic_key text NOT NULL,
  revision integer NOT NULL CHECK(revision>0), entry jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id,semantic_key), UNIQUE(brand_id,id)
);
CREATE TABLE brand_public_proofs (
  id text PRIMARY KEY, brand_id text NOT NULL, fact_id text NOT NULL, fact_revision integer NOT NULL CHECK(fact_revision>0),
  entry jsonb NOT NULL, FOREIGN KEY(brand_id,fact_id) REFERENCES brand_public_facts(brand_id,id)
);
CREATE INDEX brand_public_proofs_current ON brand_public_proofs(brand_id,fact_id,fact_revision);
CREATE TABLE brand_public_knowledge_events (
  id text PRIMARY KEY, brand_id text NOT NULL REFERENCES brands(id), actor_user_id text NOT NULL REFERENCES auth_user(id),
  fact_id text NOT NULL REFERENCES brand_public_facts(id), request_digest text NOT NULL, snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_public_knowledge_events_brand ON brand_public_knowledge_events(brand_id,created_at);
CREATE TABLE social_publication_fact_holds (
  publication_input_id text PRIMARY KEY REFERENCES social_publication_inputs(id), reason text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
