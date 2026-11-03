-- Integrity rules that must hold even if application code is wrong. See docs/ARCHITECTURE.md.
-- Everything is scoped to the "ukuphila" schema: this database may host other projects, and none of their objects is touched.

CREATE OR REPLACE FUNCTION ukuphila.append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'A tabela % é só de acrescentar: as correcções são novos registos.', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'journal_entries', 'postings', 'entry_reviews', 'audit_events', 'access_log', 'kyc_events', 'kyc_attestations',
    'document_events', 'xitique_events', 'credit_decisions', 'credit_repayments', 'sync_ops', 'risk_case_notes'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON ukuphila.%I FOR EACH ROW EXECUTE FUNCTION ukuphila.append_only()',
      t || '_append_only', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON ukuphila.%I FOR EACH STATEMENT EXECUTE FUNCTION ukuphila.append_only()',
      t || '_no_truncate', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Double entry: at commit, every journal entry balances to zero and has at least two postings.
CREATE OR REPLACE FUNCTION ukuphila.entry_balances() RETURNS trigger AS $$
DECLARE total bigint; lines integer;
BEGIN
  SELECT coalesce(sum(amount_cents), 0), count(*) INTO total, lines FROM ukuphila.postings WHERE entry_id = NEW.entry_id;
  IF total <> 0 OR lines < 2 THEN
    RAISE EXCEPTION 'Lançamento % não balanceado (soma %, % linhas).', NEW.entry_id, total, lines
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER postings_balanced
  AFTER INSERT ON ukuphila.postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ukuphila.entry_balances();
--> statement-breakpoint

-- Hosted Postgres can expose tables through a REST layer. The app connects as owner (RLS bypassed), so enabling RLS
-- with no policies denies that surface by default. Only this project's tables are affected.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'ukuphila' AND tablename <> '__migrations' LOOP
    EXECUTE format('ALTER TABLE ukuphila.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
